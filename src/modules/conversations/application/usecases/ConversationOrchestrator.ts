import type { LlmInterpretation, LlmIntent } from "@/modules/ai/application/dto/LlmInterpretation";
import type { LlmInterpreterPort } from "@/modules/ai/application/ports/LlmInterpreterPort";
import type { ResponseGeneratorPort } from "@/modules/ai/application/ports/ResponseGeneratorPort";
import type { ClinicSettingsPort } from "@/modules/clinic/application/ports/ClinicSettingsPort";
import type { ClinicSettings } from "@/modules/clinic/domain/ClinicSettings";
import type { InboundMessageCommand } from "@/modules/conversations/application/dto/InboundMessageCommand";
import type { ConversationRepositoryPort } from "@/modules/conversations/application/ports/ConversationRepositoryPort";
import type {
  CancellationHandlerPort,
  CatalogSnapshot,
  CatalogSnapshotPort,
  ConfirmPresenceHandlerPort,
  RescheduleHandlerPort,
  SchedulingIntentHandlerPort,
} from "@/modules/conversations/application/ports/IntentHandlerPorts";
import type { MessageRepositoryPort } from "@/modules/conversations/application/ports/MessageRepositoryPort";
import type {
  ProcessedInboundRepositoryPort,
  ProcessedInboundResponse,
} from "@/modules/conversations/application/ports/ProcessedInboundRepositoryPort";
import { mergeEntitiesIntoCollectedData } from "@/modules/conversations/domain/services/EntityMerger";
import { getFieldPriority, buildFunnelStep } from "@/modules/conversations/domain/services/NextQuestionBuilder";
import { detectConversationalSignals } from "@/modules/conversations/domain/services/ConversationalSignals";
import { detectServiceInfoIntent } from "@/modules/conversations/domain/services/ServiceInfoDetector";
import type { ResponseDirective } from "@/modules/conversations/domain/ResponseDirective";
import { OPENING_PATTERNS } from "@/shared/domain/constants";
import { formatDateTimePtBr } from "@/shared/time";
import {
  isIntentInformational,
  isIntentTransactional,
  resolveMissingForBooking,
  resolveMissingRequirements,
} from "@/modules/conversations/domain/services/RequirementResolver";
import type { KnowledgeRetrievalPort } from "@/modules/knowledge/application/ports/KnowledgeRetrievalPort";
import type { PatientRepositoryPort } from "@/modules/patients/application/ports/PatientRepositoryPort";
import { resolveCanonicalPatient } from "@/modules/patients/domain/PatientIdentityResolver";

export class ConversationOrchestrator {
  constructor(
    private readonly processedInboundRepository: ProcessedInboundRepositoryPort,
    private readonly patientRepository: PatientRepositoryPort,
    private readonly conversationRepository: ConversationRepositoryPort,
    private readonly messageRepository: MessageRepositoryPort,
    private readonly llmInterpreter: LlmInterpreterPort,
    private readonly catalogSnapshotPort: CatalogSnapshotPort,
    private readonly schedulingIntentUseCase: SchedulingIntentHandlerPort,
    private readonly cancelAppointmentUseCase: CancellationHandlerPort,
    private readonly confirmPresenceUseCase: ConfirmPresenceHandlerPort,
    private readonly timezone: string,
    private readonly messageContextLimit: number,
    private readonly clinicSettingsPort?: ClinicSettingsPort | null,
    private readonly responseGenerator?: ResponseGeneratorPort | null,
    private readonly knowledgeRetrieval?: KnowledgeRetrievalPort | null,
    private readonly rescheduleUseCase?: RescheduleHandlerPort | null,
  ) {}

  async execute(clinicId: string, input: InboundMessageCommand): Promise<ProcessedInboundResponse> {
    // 1. Idempotency check
    const existing = await this.processedInboundRepository.findByUniqueKey(
      input.channel,
      input.external_user_id,
      input.message_id,
    );
    if (existing) {
      return existing.response;
    }

    // 2. Load or create patient
    const patient =
      (await this.patientRepository.findByChannelAndExternalUser(clinicId, input.channel, input.external_user_id)) ??
      (await this.patientRepository.create(clinicId, input.channel, input.external_user_id));

    // Snapshot DB-stored name before this message modifies it
    const dbFullName = patient.fullName;

    patient.touchInteraction();

    // 3. Load or create conversation
    let conversation = await this.conversationRepository.findLatestByPatientAndChannel(
      patient.id,
      input.channel,
    );

    if (!conversation || conversation.state === "FINALIZADA") {
      conversation = await this.conversationRepository.create(clinicId, patient.id, input.channel);
    }

    // 4. Store inbound message
    const inboundResult = await this.messageRepository.createInbound({
      conversationId: conversation.id,
      text: input.text,
      channel: input.channel,
      externalUserId: input.external_user_id,
      messageId: input.message_id,
    });

    if (inboundResult.isDuplicate) {
      const replay = await this.processedInboundRepository.findByUniqueKey(
        input.channel,
        input.external_user_id,
        input.message_id,
      );
      if (replay) return replay.response;

      const lastOutbound = await this.messageRepository.findLastOutbound(conversation.id);
      if (lastOutbound) {
        return {
          reply_text: lastOutbound.text,
          conversation_state: conversation.state,
          patient_state: patient.state,
        };
      }
    }

    conversation.touchMessage();

    // 5. Load context
    const [recentMessages, catalogSnapshot, clinicSettings] = await Promise.all([
      this.messageRepository.listLastMessages(conversation.id, this.messageContextLimit),
      this.catalogSnapshotPort.execute(clinicId),
      this.clinicSettingsPort?.findByClinicId(clinicId) ?? Promise.resolve(null),
    ]);

    // 6. Call LLM interpreter
    // Only pass stored patient name to LLM if the conversation has already
    // explicitly collected it. This prevents the LLM from echoing DB-stored
    // names as "extracted" entities, which would skip the identity collection step.
    const bookingIntents = new Set(["BOOK_APPOINTMENT", "PAIN_OR_URGENT_CASE"]);
    const nameAlreadyCollected = Boolean(conversation.collectedData.full_name);
    const patientNameForLlm = nameAlreadyCollected ? dbFullName : null;

    const interpretation = await this.llmInterpreter.interpret({
      user_text: input.text,
      now_iso: new Date().toISOString(),
      timezone: this.timezone,
      patient_state: patient.state,
      conversation_state: conversation.state,
      current_intent: conversation.currentIntent,
      collected_data: conversation.collectedData as Record<string, unknown>,
      known_data: { patient_name: patientNameForLlm },
      catalog: catalogSnapshot,
      recent_messages: recentMessages.map((m) => ({
        direction: m.direction,
        text: m.text,
        created_at: m.createdAt.toISOString(),
      })),
    });

    // 7. Merge entities into collected data
    const mergedData = mergeEntitiesIntoCollectedData(
      conversation.collectedData,
      interpretation.entities,
    );

    const extractedName = interpretation.entities.full_name?.trim() || null;
    if (extractedName && extractedName !== patient.fullName) {
      patient.setFullName(extractedName);
    }

    // CPF extraction
    let extractedCpf = (mergedData.cpf as string)?.replace(/\D/g, "")
      || interpretation.entities.cpf?.replace(/\D/g, "")
      || null;
    if (!extractedCpf || extractedCpf.length !== 11) {
      const cpfMatch = input.text.match(/\b(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2})\b/)
        || input.text.match(/\b(\d{11})\b/);
      if (cpfMatch) {
        const digits = cpfMatch[1].replace(/\D/g, "");
        if (digits.length === 11) {
          extractedCpf = digits;
          mergedData.cpf = digits;
          interpretation.entities.cpf = digits;
        }
      }
    }
    if (extractedCpf && extractedCpf.length === 11 && extractedCpf !== patient.cpf) {
      patient.setCpf(extractedCpf);
    }

    // 7a. Cross-session identity resolution
    let allPatientIds: string[] = [patient.id];
    const patientCpf = patient.cpf || (extractedCpf && extractedCpf.length === 11 ? extractedCpf : null);
    if (patientCpf) {
      const cpfMatches = await this.patientRepository.findByCpfAndClinic(clinicId, patientCpf);
      if (cpfMatches.length > 0) {
        const resolved = resolveCanonicalPatient(cpfMatches);
        if (resolved) {
          allPatientIds = resolved.allPatientIds;
        }
      }
    }

    const extractedBirthDate = (mergedData.birth_date as string) || interpretation.entities.birth_date || null;
    if (extractedBirthDate && extractedBirthDate !== patient.birthDate) {
      patient.setBirthDate(extractedBirthDate);
    }

    // Resolve slot selection from offered availability
    if (mergedData.offered_date_iso) {
      const normalizedText = input.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const isMeioDia = /\bmeio[- ]?dia\b/.test(normalizedText);
      const timeMatch = input.text.match(/\b(\d{1,2})h(\d{2})\b/)
        || input.text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:h|hrs?)?\b/)
        || input.text.match(/\b(?:[aà]s?)\s*(\d{1,2})(?::(\d{2}))\b/);
      if (timeMatch || isMeioDia) {
        const hour = isMeioDia ? 12 : Number(timeMatch![1]);
        const minute = isMeioDia ? 0 : Number(timeMatch![2] ?? "0");
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
          const offeredDate = new Date(mergedData.offered_date_iso as string);
          const offset = "-03:00";
          const y = offeredDate.getFullYear();
          const mo = String(offeredDate.getMonth() + 1).padStart(2, "0");
          const d = String(offeredDate.getDate()).padStart(2, "0");
          const hh = String(hour).padStart(2, "0");
          const mm = String(minute).padStart(2, "0");
          const resolvedDatetime = `${y}-${mo}-${d}T${hh}:${mm}:00${offset}`;
          mergedData.datetime_iso = resolvedDatetime;
          interpretation.entities.datetime_iso = resolvedDatetime;
        }
      }
    }

    // Use patient data from DB if already known (birth_date is always safe to backfill).
    // For booking intents, skip name/cpf backfill — require explicit collection.
    const skipIdentityBackfill =
      bookingIntents.has(interpretation.intent) ||
      bookingIntents.has(conversation.currentIntent ?? "");
    if (!skipIdentityBackfill) {
      if (patient.fullName && !mergedData.full_name) mergedData.full_name = patient.fullName;
      if (patient.cpf && !mergedData.cpf) mergedData.cpf = patient.cpf;
    }
    if (patient.birthDate && !mergedData.birth_date) mergedData.birth_date = patient.birthDate;

    // 7b. Safety guard: reclassify service info queries
    const nonServiceIntents: ReadonlySet<LlmIntent> = new Set(["UNKNOWN", "GREETING", "SMALL_TALK"]);
    if (nonServiceIntents.has(interpretation.intent)) {
      const serviceInfoOverride = detectServiceInfoIntent(input.text, catalogSnapshot);
      if (serviceInfoOverride) {
        interpretation.intent = "SERVICE_INFO" as LlmIntent;
        interpretation.stage = "INFORMATIONAL_RESPONSE";
        if (serviceInfoOverride.serviceCode && !interpretation.entities.service_code) {
          interpretation.entities.service_code = serviceInfoOverride.serviceCode;
        }
      }
    }

    // 7c. TALK_TO_HUMAN guard
    if (interpretation.intent === "TALK_TO_HUMAN") {
      const isFreshConversation = conversation.attempts <= 1;
      const isOpeningMessage = this.matchesOpeningPattern(input.text);
      if (isFreshConversation && isOpeningMessage) {
        interpretation.intent = "GREETING" as LlmIntent;
        interpretation.stage = "INFORMATIONAL_RESPONSE";
      }
    }

    // 8. Determine effective intent
    const isAwaitingHoldConfirmation =
      conversation.currentFunnelStep === "AWAITING_CONFIRMATION" &&
      conversation.currentIntent === "BOOK_APPOINTMENT";

    if (isAwaitingHoldConfirmation) {
      const slotAccepted = interpretation.user_accepts_slot;
      const isRejection = slotAccepted === false || this.isSlotRejection(input.text);
      const isConfirmation = slotAccepted === true || this.isConfirmationMessage(interpretation.intent, input.text);

      if (isRejection && !isConfirmation) {
        const textHasTime = /\b\d{1,2}[h:]\d{2}\b/.test(input.text)
          || /\b\d{1,2}\s*h\b/.test(input.text)
          || /\bmeio[- ]?dia\b/i.test(input.text);

        mergedData.datetime_iso = undefined;
        mergedData.offered_date_iso = undefined;

        if (textHasTime && interpretation.entities.datetime_iso) {
          mergedData.datetime_iso = interpretation.entities.datetime_iso;
        }

        conversation.transition("AUTO");
        conversation.setCurrentFunnelStep("COLLECTING_DATA");
      } else if (isConfirmation) {
        interpretation.intent = "BOOK_APPOINTMENT" as LlmIntent;
        interpretation.stage = "USER_CONFIRMED_DETAILS" as const;
        interpretation.user_accepts_slot = true;
      }
    }

    const effectiveIntent = this.resolveEffectiveIntent(
      interpretation.intent,
      conversation.currentIntent as LlmIntent | null,
    );

    conversation.setCurrentIntent(effectiveIntent);
    conversation.setCollectedData(mergedData);

    // 9. Resolve missing requirements
    const missing = effectiveIntent === "BOOK_APPOINTMENT"
      ? resolveMissingForBooking(mergedData)
      : resolveMissingRequirements(effectiveIntent, mergedData);

    conversation.setMissingRequirements(missing);

    // 10. Detect conversational signals
    const signals = detectConversationalSignals(input.text, catalogSnapshot.services);

    // Helper: clinic context for directives
    const clinicName = clinicSettings?.clinicDisplayName ?? "Dentzi";
    const tone = clinicSettings?.tone ?? "warm_professional";
    const botName = clinicSettings?.botName ?? "Assistente Dentzi";
    const isFirstTurn = conversation.attempts <= 1;
    const knownData = this.buildKnownData(mergedData);

    const directiveBase = {
      clinic_name: clinicName,
      tone,
      bot_name: botName,
      patient_message: input.text,
      is_first_turn: isFirstTurn,
      now_iso: new Date().toISOString(),
      signals: {
        has_greeting: signals.hasGreeting,
        greeting_type: signals.greetingReply,
        has_concern: signals.hasConcern,
        has_service_mention: signals.hasServiceMention,
        mentioned_service_name: signals.mentionedServiceName,
      },
    };

    // 10a. Route to handler and build directive
    let directive: ResponseDirective;
    let response: ProcessedInboundResponse = {
      reply_text: "",
      conversation_state: conversation.state,
      patient_state: patient.state,
    };

    switch (effectiveIntent) {
      case "GREETING":
        directive = {
          ...directiveBase,
          goal: "greet_patient",
          intent: "GREETING",
          facts: [`Nome da clínica: ${clinicName}.`],
          constraints: ["Cumprimente brevemente e pergunte como pode ajudar. Máximo 2 frases."],
          known_data: knownData,
          missing_fields: [],
        };
        conversation.transition("AUTO");
        break;

      case "SMALL_TALK":
        directive = {
          ...directiveBase,
          goal: "handle_small_talk",
          intent: "SMALL_TALK",
          facts: ["O paciente fez uma pergunta genérica ou cumprimento vago."],
          constraints: ["Responda de forma amigável e ofereça ajuda. Máximo 2 frases."],
          known_data: knownData,
          missing_fields: [],
        };
        conversation.transition("AUTO");
        break;

      case "LIST_SERVICES": {
        const servicesFacts = catalogSnapshot.services.length > 0
          ? [
              "Procedimentos disponíveis:",
              ...catalogSnapshot.services.map((s) => `${s.name} — duração ${s.duration_min} min`),
            ]
          : ["Não há serviços cadastrados no momento."];

        directive = {
          ...directiveBase,
          goal: catalogSnapshot.services.length > 0 ? "list_services" : "no_services_available",
          intent: "LIST_SERVICES",
          facts: servicesFacts,
          constraints: catalogSnapshot.services.length > 0
            ? ["Apresente os procedimentos e pergunte se algum interessa."]
            : ["Sugira falar com um atendente humano."],
          known_data: knownData,
          missing_fields: [],
        };
        conversation.transition("AUTO");
        break;
      }

      case "SERVICE_INFO": {
        const serviceInfoResult = await this.handleServiceInfo(
          interpretation, clinicId, catalogSnapshot, input,
        );
        directive = {
          ...directiveBase,
          goal: "provide_service_info",
          intent: "SERVICE_INFO",
          facts: serviceInfoResult.facts,
          constraints: [
            "Responda a pergunta do paciente usando o conhecimento fornecido.",
            "Não repita informação — sintetize de forma natural.",
          ],
          known_data: knownData,
          missing_fields: [],
        };
        conversation.transition("AUTO");
        break;
      }

      case "CLINIC_INFO":
        directive = {
          ...directiveBase,
          goal: "provide_clinic_info",
          intent: "CLINIC_INFO",
          facts: [`A ${clinicName} é uma clínica odontológica com profissionais qualificados e atendimento humanizado.`],
          constraints: [],
          known_data: knownData,
          missing_fields: [],
        };
        conversation.transition("AUTO");
        break;

      case "INSURANCE_INFO":
        directive = {
          ...directiveBase,
          goal: "provide_insurance_info",
          intent: "INSURANCE_INFO",
          facts: ["A clínica atende tanto particular quanto por convênio."],
          constraints: [],
          known_data: knownData,
          missing_fields: [],
        };
        conversation.transition("AUTO");
        break;

      case "HOURS_INFO": {
        const hours = clinicSettings
          ? `${clinicSettings.workingDaysText}, das ${clinicSettings.workingHoursText}`
          : "segunda a sexta, das 08:00 às 19:00";
        directive = {
          ...directiveBase,
          goal: "provide_hours_info",
          intent: "HOURS_INFO",
          facts: [`Horário de funcionamento: ${hours}.`],
          constraints: [],
          known_data: knownData,
          missing_fields: [],
        };
        conversation.transition("AUTO");
        break;
      }

      case "LOCATION_INFO":
        directive = {
          ...directiveBase,
          goal: "provide_location_info",
          intent: "LOCATION_INFO",
          facts: ["Podemos fornecer endereço e informações de como chegar."],
          constraints: [],
          known_data: knownData,
          missing_fields: [],
        };
        conversation.transition("AUTO");
        break;

      case "RESCHEDULE_APPOINTMENT": {
        // Collect name and CPF before reschedule lookup
        if (!patient.fullName && !mergedData.full_name) {
          directive = {
            ...directiveBase,
            goal: "ask_missing_field:full_name",
            intent: "RESCHEDULE_APPOINTMENT",
            facts: ["Precisamos do nome completo para localizar o agendamento."],
            constraints: [],
            known_data: knownData,
            missing_fields: ["full_name"],
          };
          conversation.transition("AUTO");
          break;
        }
        if (!patient.cpf && !mergedData.cpf) {
          directive = {
            ...directiveBase,
            goal: "ask_missing_field:cpf",
            intent: "RESCHEDULE_APPOINTMENT",
            facts: ["Precisamos do CPF para localizar o agendamento."],
            constraints: [],
            known_data: knownData,
            missing_fields: ["cpf"],
          };
          conversation.transition("AUTO");
          break;
        }

        const rescheduleDirective = await this.handleReschedule(clinicId, patient, interpretation, input, mergedData, conversation, allPatientIds);
        directive = { ...directiveBase, ...rescheduleDirective, known_data: knownData };
        if (rescheduleDirective.conversation_state !== "HUMAN") {
          conversation.transition(rescheduleDirective.conversation_state as "AUTO" | "WAITING");
        }

        // Extract appointment from tool_results if present
        if (rescheduleDirective.tool_results?.appointment) {
          response = {
            ...response,
            appointment: rescheduleDirective.tool_results.appointment as ProcessedInboundResponse["appointment"],
          };
        }
        break;
      }

      case "BOOK_APPOINTMENT":
      case "PAIN_OR_URGENT_CASE": {
        if (effectiveIntent === "PAIN_OR_URGENT_CASE" && !mergedData.urgency_level) {
          mergedData.urgency_level = "ALTA";
          conversation.setCollectedData(mergedData);
        }

        const bookingMissing = resolveMissingForBooking(mergedData);
        conversation.setMissingRequirements(bookingMissing);

        if (bookingMissing.length > 0) {
          const hasActiveHold = conversation.state === "WAITING";
          const userAlreadySelectedSlot = Boolean(mergedData.datetime_iso);
          const needsName = bookingMissing.includes("full_name");
          const needsCareType = bookingMissing.includes("care_type");
          const needsService = bookingMissing.includes("service_code");
          const needsDatetime = bookingMissing.includes("datetime_iso");

          const funnelStep = hasActiveHold
            ? "AWAITING_CONFIRMATION"
            : buildFunnelStep(effectiveIntent, bookingMissing, false);
          conversation.setCurrentFunnelStep(funnelStep);
          if (!hasActiveHold) conversation.transition("AUTO");

          if (needsService) {
            const serviceList = catalogSnapshot.services.map((s) => s.name);
            directive = {
              ...directiveBase,
              goal: "ask_missing_field:service_code",
              intent: effectiveIntent,
              facts: serviceList.length > 0
                ? ["Procedimentos disponíveis:", ...serviceList]
                : [],
              constraints: ["Pergunte qual procedimento o paciente deseja agendar."],
              known_data: knownData,
              missing_fields: bookingMissing,
            };
          } else if (needsName) {
            directive = {
              ...directiveBase,
              goal: "ask_missing_field:full_name",
              intent: effectiveIntent,
              facts: [],
              constraints: ["Peça o nome completo do paciente."],
              known_data: knownData,
              missing_fields: bookingMissing,
            };
          } else if (bookingMissing.includes("cpf")) {
            directive = {
              ...directiveBase,
              goal: "ask_missing_field:cpf",
              intent: effectiveIntent,
              facts: [],
              constraints: ["Peça o CPF do paciente."],
              known_data: knownData,
              missing_fields: bookingMissing,
            };
          } else if (needsCareType) {
            directive = {
              ...directiveBase,
              goal: "ask_missing_field:care_type",
              intent: effectiveIntent,
              facts: [],
              constraints: ["Pergunte se o atendimento será particular ou por convênio."],
              known_data: knownData,
              missing_fields: bookingMissing,
            };
          } else if (needsDatetime && !hasActiveHold && !userAlreadySelectedSlot) {
            // Proactive availability lookup — forward all collected entities
            const scheduling = await this.schedulingIntentUseCase.execute({
              clinic_id: clinicId,
              patient_id: patient.id,
              conversation_id: conversation.id,
              patient_known_name: patient.fullName,
              interpretation: {
                ...interpretation,
                intent: "BOOK_APPOINTMENT" as LlmIntent,
                entities: {
                  ...interpretation.entities,
                  service_code: mergedData.service_code as string,
                  professional_name: mergedData.professional_name as string | undefined,
                },
              },
              now: new Date(),
            });

            if (scheduling.conversation_state === "WAITING") {
              conversation.transition("WAITING");
              conversation.setCurrentFunnelStep("AWAITING_CONFIRMATION");
            }

            const offeredDate = new Date();
            offeredDate.setDate(offeredDate.getDate() + 1);
            mergedData.offered_date_iso = offeredDate.toISOString();
            conversation.setCollectedData(mergedData);

            directive = {
              ...directiveBase,
              goal: scheduling.goal,
              intent: effectiveIntent,
              facts: scheduling.facts,
              constraints: scheduling.constraints,
              known_data: knownData,
              missing_fields: scheduling.missing_fields,
            };
          } else {
            // Fallback: ask for remaining field
            const nextField = getFieldPriority(effectiveIntent, bookingMissing)
              .find((f) => bookingMissing.includes(f)) ?? bookingMissing[0];
            directive = {
              ...directiveBase,
              goal: `ask_missing_field:${nextField}`,
              intent: effectiveIntent,
              facts: [],
              constraints: [],
              known_data: knownData,
              missing_fields: bookingMissing,
            };
          }
        } else {
          // All required data collected
          const shouldAutoConfirm =
            (conversation.currentFunnelStep === "AWAITING_CONFIRMATION" ||
            conversation.state === "WAITING") &&
            interpretation.user_accepts_slot !== false;

          const schedulingInterpretation = {
            ...interpretation,
            intent: (effectiveIntent === "PAIN_OR_URGENT_CASE" ? "BOOK_APPOINTMENT" : effectiveIntent) as LlmIntent,
            ...(shouldAutoConfirm
              ? { stage: "USER_CONFIRMED_DETAILS" as const, user_accepts_slot: true }
              : {}),
            entities: {
              ...interpretation.entities,
              full_name: mergedData.full_name as string | undefined,
              service_code: mergedData.service_code as string | undefined,
              professional_name: mergedData.professional_name as string | undefined,
              datetime_iso: mergedData.datetime_iso as string | undefined,
            },
          };

          const scheduling = await this.schedulingIntentUseCase.execute({
            clinic_id: clinicId,
            patient_id: patient.id,
            conversation_id: conversation.id,
            patient_known_name: patient.fullName,
            interpretation: schedulingInterpretation,
            now: new Date(),
          });

          if (scheduling.patient_name_captured && scheduling.patient_name_captured !== patient.fullName) {
            patient.setFullName(scheduling.patient_name_captured);
          }

          if (scheduling.appointment) {
            patient.activate();
            conversation.setCurrentFunnelStep("COMPLETED");
          } else {
            const funnelStep = buildFunnelStep(effectiveIntent, [], scheduling.conversation_state === "WAITING");
            conversation.setCurrentFunnelStep(funnelStep);
          }

          conversation.transition(scheduling.conversation_state);

          directive = {
            ...directiveBase,
            goal: scheduling.goal,
            intent: effectiveIntent,
            facts: scheduling.facts,
            constraints: scheduling.constraints,
            known_data: knownData,
            missing_fields: scheduling.missing_fields,
          };

          if (scheduling.appointment) {
            response = {
              ...response,
              appointment: {
                id: scheduling.appointment.id,
                status: scheduling.appointment.status,
                starts_at: scheduling.appointment.starts_at,
                ends_at: scheduling.appointment.ends_at,
                professional_name: scheduling.appointment.professional_name,
                service_code: scheduling.appointment.service_code,
              },
            };
          }
        }
        break;
      }

      case "CHECK_AVAILABILITY": {
        const scheduling = await this.schedulingIntentUseCase.execute({
          clinic_id: clinicId,
          patient_id: patient.id,
          conversation_id: conversation.id,
          patient_known_name: patient.fullName,
          interpretation: {
            ...interpretation,
            intent: "BOOK_APPOINTMENT" as LlmIntent,
            entities: {
              ...interpretation.entities,
              service_code: mergedData.service_code as string | undefined,
              professional_name: mergedData.professional_name as string | undefined,
              datetime_iso: mergedData.datetime_iso as string | undefined,
            },
          },
          now: new Date(),
        });

        conversation.transition(scheduling.conversation_state);

        directive = {
          ...directiveBase,
          goal: scheduling.goal,
          intent: "CHECK_AVAILABILITY",
          facts: scheduling.facts,
          constraints: scheduling.constraints,
          known_data: knownData,
          missing_fields: scheduling.missing_fields,
        };
        break;
      }

      case "CANCEL_APPOINTMENT": {
        let requestedDatetime = interpretation.entities.datetime_iso ?? null;
        if (!requestedDatetime) {
          const storedOptions = mergedData.pending_cancel_options as string | undefined;
          if (storedOptions) {
            const selectedIndex = this.extractNumericSelection(input.text);
            if (selectedIndex !== null) {
              try {
                const options = JSON.parse(storedOptions) as Array<{ starts_at_iso: string }>;
                if (selectedIndex >= 0 && selectedIndex < options.length) {
                  requestedDatetime = options[selectedIndex].starts_at_iso;
                }
              } catch { /* ignore */ }
            }
          }
        }

        const cancellation = await this.cancelAppointmentUseCase.execute({
          patient_id: patient.id,
          all_patient_ids: allPatientIds,
          requested_datetime_iso: requestedDatetime,
          reason: input.text,
          now: new Date(),
        });

        conversation.transition("AUTO");

        if (cancellation.kind === "NO_APPOINTMENTS") {
          mergedData.pending_cancel_options = undefined;
          conversation.setCollectedData(mergedData);
          directive = {
            ...directiveBase,
            goal: "no_appointments_to_cancel",
            intent: "CANCEL_APPOINTMENT",
            facts: ["O paciente não possui agendamentos ativos para cancelamento."],
            constraints: [],
            known_data: knownData,
            missing_fields: [],
          };
        } else if (cancellation.kind === "NEEDS_CLARIFICATION") {
          mergedData.pending_cancel_options = JSON.stringify(cancellation.options);
          conversation.setCollectedData(mergedData);
          const optionsFacts = cancellation.options
            .map((item, i) => `${i + 1}) ${formatDateTimePtBr(new Date(item.starts_at_iso))} - ${item.service_code} com ${item.professional_name}`);
          directive = {
            ...directiveBase,
            goal: "clarify_which_appointment_to_cancel",
            intent: "CANCEL_APPOINTMENT",
            facts: ["O paciente possui múltiplos agendamentos:", ...optionsFacts],
            constraints: ["Pergunte qual agendamento deseja cancelar."],
            known_data: knownData,
            missing_fields: ["appointment_id"],
          };
        } else {
          mergedData.pending_cancel_options = undefined;
          conversation.setCollectedData(mergedData);
          directive = {
            ...directiveBase,
            goal: "appointment_cancelled",
            intent: "CANCEL_APPOINTMENT",
            facts: [`Agendamento cancelado: ${formatDateTimePtBr(new Date(cancellation.appointment.starts_at_iso))} (${cancellation.appointment.service_code}).`],
            constraints: [],
            known_data: knownData,
            missing_fields: [],
          };
          response = {
            ...response,
            appointment: {
              id: cancellation.appointment.id,
              status: cancellation.appointment.status,
              starts_at: cancellation.appointment.starts_at_iso,
              ends_at: cancellation.appointment.ends_at_iso,
              professional_name: cancellation.appointment.professional_name,
              service_code: cancellation.appointment.service_code,
            },
          };
        }
        break;
      }

      case "CONFIRM_APPOINTMENT": {
        const confirmation = await this.confirmPresenceUseCase.execute({
          patient_id: patient.id,
          all_patient_ids: allPatientIds,
          requested_datetime_iso: interpretation.entities.datetime_iso,
          now: new Date(),
        });

        conversation.transition("AUTO");

        if (confirmation.kind === "NO_APPOINTMENTS") {
          directive = {
            ...directiveBase,
            goal: "no_appointments_to_confirm",
            intent: "CONFIRM_APPOINTMENT",
            facts: ["Não há agendamento pendente para confirmar presença."],
            constraints: [],
            known_data: knownData,
            missing_fields: [],
          };
        } else if (confirmation.kind === "NEEDS_CLARIFICATION") {
          const optionsFacts = confirmation.options
            .map((item, i) => `${i + 1}) ${formatDateTimePtBr(new Date(item.starts_at_iso))} - ${item.service_code} com ${item.professional_name}`);
          directive = {
            ...directiveBase,
            goal: "clarify_which_appointment_to_confirm",
            intent: "CONFIRM_APPOINTMENT",
            facts: ["O paciente possui múltiplos agendamentos:", ...optionsFacts],
            constraints: ["Pergunte qual agendamento deseja confirmar."],
            known_data: knownData,
            missing_fields: ["appointment_id"],
          };
        } else {
          directive = {
            ...directiveBase,
            goal: "presence_confirmed",
            intent: "CONFIRM_APPOINTMENT",
            facts: [`Presença confirmada para ${formatDateTimePtBr(new Date(confirmation.appointment.starts_at_iso))}.`],
            constraints: [],
            known_data: knownData,
            missing_fields: [],
          };
          response = {
            ...response,
            appointment: {
              id: confirmation.appointment.id,
              status: confirmation.appointment.status,
              starts_at: confirmation.appointment.starts_at_iso,
              ends_at: confirmation.appointment.ends_at_iso,
              professional_name: confirmation.appointment.professional_name,
              service_code: confirmation.appointment.service_code,
            },
          };
        }
        break;
      }

      case "TALK_TO_HUMAN":
        conversation.transition("HUMAN");
        directive = {
          ...directiveBase,
          goal: "escalate_to_human",
          intent: "TALK_TO_HUMAN",
          facts: ["O paciente será encaminhado para um atendente humano."],
          constraints: ["Informe que vai transferir para um atendente. Seja breve."],
          known_data: knownData,
          missing_fields: [],
        };
        break;

      default: {
        conversation.transition("AUTO");
        const maxUnknown = clinicSettings?.maxUnknownBeforeFallback ?? 3;
        const shouldEscalate = conversation.attempts >= maxUnknown;
        directive = {
          ...directiveBase,
          goal: shouldEscalate ? "escalate_after_failures" : "handle_unknown",
          intent: "UNKNOWN",
          facts: shouldEscalate
            ? ["O paciente não foi compreendido após múltiplas tentativas."]
            : [],
          constraints: shouldEscalate
            ? ["Sugira encaminhar para um atendente humano."]
            : ["Peça ao paciente para reformular. Máximo 2 frases."],
          known_data: knownData,
          missing_fields: [],
        };
        break;
      }
    }

    // 11. Generate reply text via LLM
    const replyText = await this.generateReply(directive);

    response = {
      ...response,
      reply_text: replyText,
      conversation_state: conversation.state,
      patient_state: patient.state,
    };

    // 12. Persist state
    await Promise.all([
      this.patientRepository.save(patient),
      this.conversationRepository.save(conversation),
      this.messageRepository.createOutbound({
        conversationId: conversation.id,
        text: response.reply_text,
        channel: input.channel,
        externalUserId: input.external_user_id,
        llmIntent: effectiveIntent,
        entitiesJson: interpretation.entities as Record<string, unknown>,
      }),
    ]);

    // 13. Store processed inbound for idempotency
    await this.processedInboundRepository.save({
      channel: input.channel,
      externalUserId: input.external_user_id,
      messageId: input.message_id,
      conversationId: conversation.id,
      response,
    });

    return response;
  }

  /**
   * Generate reply text from a ResponseDirective.
   * Uses LLM when available, falls back to joining facts.
   */
  private async generateReply(directive: ResponseDirective): Promise<string> {
    if (this.responseGenerator) {
      try {
        return await this.responseGenerator.generate(directive);
      } catch (error) {
        console.warn("[Orchestrator] LLM response generation failed, using fallback:", error);
      }
    }
    // Fallback: join facts into a plain response
    return directive.facts.length > 0
      ? directive.facts.join(" ")
      : "Como posso te ajudar?";
  }

  private buildKnownData(mergedData: Record<string, unknown>): Record<string, string> {
    const known: Record<string, string> = {};
    const fields = ["full_name", "cpf", "care_type", "service_code", "datetime_iso", "professional_name", "birth_date"];
    for (const f of fields) {
      const v = mergedData[f];
      if (v && typeof v === "string") known[f] = v;
    }
    return known;
  }

  private async handleServiceInfo(
    interpretation: LlmInterpretation,
    clinicId: string,
    catalogSnapshot: CatalogSnapshot,
    input: InboundMessageCommand,
  ): Promise<{ facts: string[] }> {
    const serviceCode = interpretation.entities.service_code;
    const matchedService = serviceCode
      ? catalogSnapshot.services.find((s) => s.service_code === serviceCode)
      : null;

    if (!matchedService) {
      const serviceNames = catalogSnapshot.services.map((s) => s.name);
      return {
        facts: serviceNames.length > 0
          ? ["Procedimentos disponíveis:", ...serviceNames]
          : ["Nenhum procedimento cadastrado no momento."],
      };
    }

    // RAG: retrieve knowledge documents
    const knowledgeContent = await this.retrieveServiceKnowledge(
      clinicId, matchedService.service_code, matchedService.name, input.text,
    );

    const facts: string[] = [
      `Serviço: ${matchedService.name} (duração média: ${matchedService.duration_min} minutos).`,
    ];

    if (knowledgeContent && knowledgeContent.length > 0) {
      facts.push(...knowledgeContent.map((doc) => doc.content));
    }

    // Look up availability for this service
    const scheduling = await this.schedulingIntentUseCase.execute({
      clinic_id: clinicId,
      patient_id: "",
      conversation_id: "",
      patient_known_name: null,
      interpretation: {
        ...interpretation,
        intent: "BOOK_APPOINTMENT",
        entities: { ...interpretation.entities, service_code: matchedService.service_code },
      },
      now: new Date(),
    });

    facts.push(...scheduling.facts);

    return { facts };
  }

  private async retrieveServiceKnowledge(
    clinicId: string,
    serviceCode: string,
    serviceName: string,
    _userMessage: string,
  ): Promise<Array<{ title: string; content: string }> | null> {
    if (!this.knowledgeRetrieval) return null;

    const results = await this.knowledgeRetrieval.findRelevant({
      clinicId,
      category: serviceCode,
      searchText: serviceName,
      limit: 5,
    });

    if (results.length === 0) {
      const broader = await this.knowledgeRetrieval.findRelevant({
        clinicId,
        searchText: serviceName,
        limit: 3,
      });
      return broader.length > 0
        ? broader.map((d) => ({ title: d.title, content: d.content }))
        : null;
    }

    return results.map((d) => ({ title: d.title, content: d.content }));
  }

  private async handleReschedule(
    clinicId: string,
    patient: { id: string; fullName: string | null; cpf: string | null; state: string },
    interpretation: LlmInterpretation,
    input: InboundMessageCommand,
    mergedData: Record<string, string | boolean | null | undefined>,
    conversation: { id: string; setCollectedData: (data: Record<string, string | boolean | null | undefined>) => void },
    allPatientIds: string[],
  ): Promise<Pick<ResponseDirective, "goal" | "intent" | "facts" | "constraints" | "missing_fields" | "tool_results"> & { conversation_state: "AUTO" | "WAITING" | "HUMAN" }> {
    if (!this.rescheduleUseCase) {
      return {
        goal: "reschedule_unavailable",
        intent: "RESCHEDULE_APPOINTMENT",
        facts: ["O reagendamento não está disponível por este canal."],
        constraints: ["Sugira entrar em contato direto com a clínica."],
        missing_fields: [],
        conversation_state: "AUTO",
      };
    }

    const newDatetime = (mergedData.datetime_iso as string) || interpretation.entities.datetime_iso || null;

    let requestedDatetime: string | null = null;
    const storedOptions = mergedData.pending_reschedule_options as string | undefined;
    if (storedOptions) {
      const selectedIndex = this.extractNumericSelection(input.text);
      if (selectedIndex !== null) {
        try {
          const options = JSON.parse(storedOptions) as Array<{ starts_at_iso: string }>;
          if (selectedIndex >= 0 && selectedIndex < options.length) {
            requestedDatetime = options[selectedIndex].starts_at_iso;
          }
        } catch { /* ignore */ }
      }
    }

    const result = await this.rescheduleUseCase.execute({
      patient_id: patient.id,
      all_patient_ids: allPatientIds,
      clinic_id: clinicId,
      patient_name: patient.fullName,
      patient_cpf: patient.cpf,
      requested_datetime_iso: requestedDatetime,
      new_datetime_iso: newDatetime,
      now: new Date(),
    });

    switch (result.kind) {
      case "NO_APPOINTMENTS":
        mergedData.pending_reschedule_options = undefined;
        conversation.setCollectedData(mergedData);
        return {
          goal: "no_appointments_to_reschedule",
          intent: "RESCHEDULE_APPOINTMENT",
          facts: ["Não há agendamentos futuros para reagendar."],
          constraints: [],
          missing_fields: [],
          conversation_state: "AUTO",
        };

      case "NEEDS_CLARIFICATION": {
        mergedData.pending_reschedule_options = JSON.stringify(result.options);
        conversation.setCollectedData(mergedData);
        const optionsFacts = result.options
          .map((item, i) => `${i + 1}) ${item.service_code} com ${item.professional_name} — ${formatDateTimePtBr(new Date(item.starts_at_iso))}`);
        return {
          goal: "clarify_which_appointment_to_reschedule",
          intent: "RESCHEDULE_APPOINTMENT",
          facts: ["O paciente possui múltiplos agendamentos:", ...optionsFacts],
          constraints: ["Pergunte qual agendamento deseja reagendar."],
          missing_fields: ["appointment_id"],
          conversation_state: "AUTO",
        };
      }

      case "NEEDS_NEW_DATETIME": {
        const apt = result.current_appointment;
        return {
          goal: "ask_new_datetime_for_reschedule",
          intent: "RESCHEDULE_APPOINTMENT",
          facts: [`Agendamento encontrado: ${apt.service_code} com ${apt.professional_name}.`],
          constraints: ["Pergunte para qual dia e horário o paciente gostaria de mudar."],
          missing_fields: ["datetime_iso"],
          conversation_state: "AUTO",
        };
      }

      case "SLOT_UNAVAILABLE": {
        const facts = ["O horário solicitado não está disponível."];
        if (result.available_times && result.available_times.length > 0) {
          facts.push(`Horários mais próximos: ${result.available_times.join(", ")}.`);
        }
        return {
          goal: "reschedule_slot_unavailable",
          intent: "RESCHEDULE_APPOINTMENT",
          facts,
          constraints: result.available_times?.length ? ["Apresente os horários alternativos."] : [],
          missing_fields: ["datetime_iso"],
          conversation_state: "AUTO",
        };
      }

      case "RESCHEDULED": {
        const apt = result.new_appointment;
        return {
          goal: "appointment_rescheduled",
          intent: "RESCHEDULE_APPOINTMENT",
          facts: [`Atendimento reagendado para ${formatDateTimePtBr(new Date(apt.starts_at_iso))} com ${apt.professional_name}.`],
          constraints: [],
          missing_fields: [],
          conversation_state: "AUTO",
          tool_results: {
            appointment: {
              id: apt.id,
              status: apt.status,
              starts_at: apt.starts_at_iso,
              ends_at: apt.ends_at_iso,
              professional_name: apt.professional_name,
              service_code: apt.service_code,
            },
          },
        };
      }
    }
  }

  private matchesOpeningPattern(text: string): boolean {
    const n = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const original = text.toLowerCase();
    return OPENING_PATTERNS.some((p) => p.test(original) || p.test(n));
  }

  private isSlotRejection(text: string): boolean {
    const n = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return (
      /\bprefiro\b/.test(n) || /\bmelhor\b/.test(n) || /\boutro\b/.test(n) ||
      /\boutra\b/.test(n) || /\bmudar\b/.test(n) || /\btrocar\b/.test(n) ||
      /\bnao\b/.test(n) || /\bnao quero\b/.test(n) || /\bnao posso\b/.test(n) ||
      /\bnao consigo\b/.test(n) || /\bnao da\b/.test(n) || /\bacho que\b/.test(n) ||
      /\bna verdade\b/.test(n) || /\bpensando bem\b/.test(n)
    );
  }

  private isConfirmationMessage(llmIntent: LlmIntent, text: string): boolean {
    if (llmIntent === "CONFIRM_APPOINTMENT") return true;
    const normalized = text.toLowerCase().trim();
    return /\bconfirmo\b/.test(normalized) || /\bsim\b/.test(normalized) || /\bpode ser\b/.test(normalized);
  }

  private resolveEffectiveIntent(
    llmIntent: LlmIntent,
    currentConversationIntent: LlmIntent | null,
  ): LlmIntent {
    if (currentConversationIntent && isIntentTransactional(currentConversationIntent)) {
      if (llmIntent === "UNKNOWN" || llmIntent === "GREETING" || llmIntent === "SMALL_TALK") {
        return currentConversationIntent;
      }
    }
    return llmIntent;
  }

  private extractNumericSelection(text: string): number | null {
    const n = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    const ordinalMap: Record<string, number> = {
      primeiro: 0, primeira: 0,
      segundo: 1, segunda: 1,
      terceiro: 2, terceira: 2,
      quarto: 3, quarta: 3,
      quinto: 4, quinta: 4,
    };

    for (const [word, idx] of Object.entries(ordinalMap)) {
      if (n.includes(word)) return idx;
    }

    const match = n.match(/\b(\d)\b/);
    if (match) {
      const num = Number(match[1]);
      if (num >= 1 && num <= 9) return num - 1;
    }

    return null;
  }
}
