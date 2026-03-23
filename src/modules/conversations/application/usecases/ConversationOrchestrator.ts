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
  SchedulingIntentHandlerPort,
} from "@/modules/conversations/application/ports/IntentHandlerPorts";
import type { MessageRepositoryPort } from "@/modules/conversations/application/ports/MessageRepositoryPort";
import type {
  ProcessedInboundRepositoryPort,
  ProcessedInboundResponse,
} from "@/modules/conversations/application/ports/ProcessedInboundRepositoryPort";
import { mergeEntitiesIntoCollectedData } from "@/modules/conversations/domain/services/EntityMerger";
import { buildNextQuestion, buildFunnelStep } from "@/modules/conversations/domain/services/NextQuestionBuilder";
import { composeResponse, resolveTemplate, buildServiceListText } from "@/modules/conversations/domain/services/ResponseComposer";
import { detectServiceInfoIntent } from "@/modules/conversations/domain/services/ServiceInfoDetector";
import {
  detectConversationalSignals,
  buildAcknowledgmentPrefix,
  type ConversationalSignals,
} from "@/modules/conversations/domain/services/ConversationalSignals";
import { OPENING_PATTERNS } from "@/shared/domain/constants";
import {
  isIntentInformational,
  isIntentTransactional,
  resolveMissingForBooking,
  resolveMissingRequirements,
} from "@/modules/conversations/domain/services/RequirementResolver";
import type { KnowledgeRetrievalPort } from "@/modules/knowledge/application/ports/KnowledgeRetrievalPort";
import type { PatientRepositoryPort } from "@/modules/patients/application/ports/PatientRepositoryPort";

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

    // 5. Load context (clinic settings loaded in parallel)
    const [recentMessages, catalogSnapshot, clinicSettings] = await Promise.all([
      this.messageRepository.listLastMessages(conversation.id, this.messageContextLimit),
      this.catalogSnapshotPort.execute(clinicId),
      this.clinicSettingsPort?.findByClinicId(clinicId) ?? Promise.resolve(null),
    ]);

    // 6. Call LLM interpreter
    const interpretation = await this.llmInterpreter.interpret({
      user_text: input.text,
      now_iso: new Date().toISOString(),
      timezone: this.timezone,
      patient_state: patient.state,
      conversation_state: conversation.state,
      current_intent: conversation.currentIntent,
      collected_data: conversation.collectedData as Record<string, unknown>,
      known_data: {
        patient_name: patient.fullName,
      },
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

    // Capture patient name if provided
    const extractedName = interpretation.entities.full_name?.trim() || null;
    if (extractedName && extractedName !== patient.fullName) {
      patient.setFullName(extractedName);
    }

    // Use patient name from DB if already known
    if (patient.fullName && !mergedData.full_name) {
      mergedData.full_name = patient.fullName;
    }

    // 7b. Safety guard: reclassify if backend detects a service info query
    // that the LLM/mock misclassified as UNKNOWN, GREETING, or SMALL_TALK.
    // This prevents informational service questions from falling into fallback.
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

    // 7c. Context-aware TALK_TO_HUMAN guard.
    // On a fresh conversation (low attempt count), opening/presence-check messages
    // like "tem alguém aí?" should NOT trigger human handoff — they're greetings.
    // Only allow TALK_TO_HUMAN when the request is truly explicit or contextually
    // justified (after repeated failures).
    if (interpretation.intent === "TALK_TO_HUMAN") {
      const isFreshConversation = conversation.attempts <= 1;
      const isOpeningMessage = this.matchesOpeningPattern(input.text);
      if (isFreshConversation && isOpeningMessage) {
        // Downgrade to GREETING — user is just checking if someone is here
        interpretation.intent = "GREETING" as LlmIntent;
        interpretation.stage = "INFORMATIONAL_RESPONSE";
      }
    }

    // 8. Determine effective intent (maintain conversation intent if appropriate)
    const isAwaitingHoldConfirmation =
      conversation.currentFunnelStep === "AWAITING_CONFIRMATION" &&
      conversation.currentIntent === "BOOK_APPOINTMENT";

    if (isAwaitingHoldConfirmation && this.isConfirmationMessage(interpretation.intent, input.text)) {
      interpretation.intent = "BOOK_APPOINTMENT" as LlmIntent;
      interpretation.stage = "USER_CONFIRMED_DETAILS";
      interpretation.user_accepts_slot = true;
    }

    const effectiveIntent = this.resolveEffectiveIntent(
      interpretation.intent,
      conversation.currentIntent as LlmIntent | null,
    );

    conversation.setCurrentIntent(effectiveIntent);
    conversation.setCollectedData(mergedData);

    // 9. Resolve missing requirements (backend-authoritative)
    const missing = effectiveIntent === "BOOK_APPOINTMENT"
      ? resolveMissingForBooking(mergedData)
      : resolveMissingRequirements(effectiveIntent, mergedData);

    conversation.setMissingRequirements(missing);

    // 10. Detect conversational signals (used by response composition below)
    const signals = detectConversationalSignals(input.text, catalogSnapshot.services);

    // 10a. Route to handler and build response
    let response: ProcessedInboundResponse;

    switch (effectiveIntent) {
      case "GREETING":
        response = await this.handleGreeting(clinicSettings, catalogSnapshot, patient.state, input.text, signals);
        conversation.transition("AUTO");
        break;

      case "SMALL_TALK":
        response = this.handleSmallTalk(catalogSnapshot, patient.state);
        conversation.transition("AUTO");
        break;

      case "LIST_SERVICES":
        response = this.handleListServices(catalogSnapshot, patient.state);
        conversation.transition("AUTO");
        break;

      case "SERVICE_INFO":
        response = await this.handleServiceInfo(
          interpretation, clinicId, catalogSnapshot, patient, input,
        );
        conversation.transition("AUTO");
        break;

      case "CLINIC_INFO":
      case "INSURANCE_INFO":
      case "HOURS_INFO":
      case "LOCATION_INFO":
        response = this.handleInformational(effectiveIntent, clinicSettings, catalogSnapshot, patient.state);
        conversation.transition("AUTO");
        break;

      case "BOOK_APPOINTMENT":
      case "RESCHEDULE_APPOINTMENT":
      case "PAIN_OR_URGENT_CASE": {
        if (effectiveIntent === "PAIN_OR_URGENT_CASE" && !mergedData.urgency_level) {
          mergedData.urgency_level = "ALTA";
          conversation.setCollectedData(mergedData);
        }

        const bookingMissing = resolveMissingForBooking(mergedData);
        conversation.setMissingRequirements(bookingMissing);

        if (bookingMissing.length > 0) {
          // Preserve WAITING state if a hold exists (don't regress to AUTO)
          const hasActiveHold = conversation.state === "WAITING";
          const funnelStep = hasActiveHold
            ? "AWAITING_CONFIRMATION"
            : buildFunnelStep(effectiveIntent, bookingMissing, false);
          conversation.setCurrentFunnelStep(funnelStep);
          if (!hasActiveHold) {
            conversation.transition("AUTO");
          }

          // PROACTIVE SCHEDULING: when service is known but datetime is missing,
          // look up availability FIRST and present real slots — don't ask
          // "qual dia e horário?" before offering concrete options.
          const serviceKnown = !bookingMissing.includes("service_code") && mergedData.service_code;
          const datetimeMissing = bookingMissing.includes("datetime_iso");

          if (serviceKnown && datetimeMissing) {
            // PROACTIVE SCHEDULING: delegate to handler for forward-search availability
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
                },
              },
              now: new Date(),
            });

            // Update conversation state from handler (important: if handler created
            // a hold and returned WAITING, the conversation must transition to WAITING
            // so the confirmation flow works on the next turn).
            if (scheduling.conversation_state === "WAITING") {
              conversation.transition("WAITING");
              conversation.setCurrentFunnelStep("AWAITING_CONFIRMATION");
            }

            // If there are other missing fields (name, care_type), note them but
            // show availability first — those fields can be collected later.
            const replyParts: string[] = [scheduling.reply_text];

            const stillNeedName = bookingMissing.includes("full_name");
            if (stillNeedName) {
              replyParts.push("Pra eu reservar, pode me dizer seu nome completo?");
            }

            const composedReply = await composeResponse({
              generator: this.responseGenerator ?? null,
              settings: clinicSettings,
              templateKey: "ask_name",
              facts: replyParts,
              userMessage: input.text,
              isFirstTurn: conversation.attempts <= 1,
              signals,
              constraints: [
                "Não confirme agendamentos",
                "Não invente horários ou profissionais",
                ...(conversation.attempts > 1 ? ["NÃO cumprimente. A conversa já começou."] : []),
              ],
            });

            // If the handler returned an appointment (all data was already collected),
            // propagate it in the response.
            response = {
              reply_text: composedReply,
              conversation_state: conversation.state,
              patient_state: patient.state,
              ...(scheduling.appointment ? { appointment: scheduling.appointment } : {}),
            };
          } else {
            // Other missing fields (service, care_type, etc.) — ask normally
            const templateQuestion = buildNextQuestion(
              bookingMissing,
              effectiveIntent,
              interpretation.suggested_next_question,
              {
                settings: clinicSettings,
                catalogServices: catalogSnapshot.services.map((s) => ({ name: s.name })),
                catalogProfessionals: catalogSnapshot.professionals,
              },
            );

            const isFirstTurn = conversation.attempts <= 1;
            const composedReply = await composeResponse({
              generator: this.responseGenerator ?? null,
              settings: clinicSettings,
              templateKey: "ask_name",
              facts: [templateQuestion],
              userMessage: input.text,
              isFirstTurn,
              signals,
              constraints: [
                "Não confirme agendamentos",
                "Não invente dados do paciente",
                ...(!isFirstTurn ? ["NÃO cumprimente. A conversa já começou."] : []),
              ],
            });

            response = {
              reply_text: composedReply,
              conversation_state: conversation.state,
              patient_state: patient.state,
            };
          }
        } else {
          // All required data collected. If a hold already exists (AWAITING_CONFIRMATION),
          // force the confirmation path so the handler confirms the hold instead of
          // creating a new one.
          const shouldAutoConfirm =
            conversation.currentFunnelStep === "AWAITING_CONFIRMATION" ||
            conversation.state === "WAITING";

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

          response = {
            reply_text: scheduling.reply_text,
            conversation_state: conversation.state,
            patient_state: patient.state,
            ...(scheduling.appointment
              ? {
                  appointment: {
                    id: scheduling.appointment.id,
                    status: scheduling.appointment.status,
                    starts_at: scheduling.appointment.starts_at,
                    ends_at: scheduling.appointment.ends_at,
                    professional_name: scheduling.appointment.professional_name,
                    service_code: scheduling.appointment.service_code,
                  },
                }
              : {}),
          };
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
              datetime_iso: mergedData.datetime_iso as string | undefined,
            },
          },
          now: new Date(),
        });

        conversation.transition(scheduling.conversation_state);

        response = {
          reply_text: scheduling.reply_text,
          conversation_state: conversation.state,
          patient_state: patient.state,
        };
        break;
      }

      case "CANCEL_APPOINTMENT": {
        const cancellation = await this.cancelAppointmentUseCase.execute({
          patient_id: patient.id,
          requested_datetime_iso: interpretation.entities.datetime_iso,
          reason: input.text,
          now: new Date(),
        });

        conversation.transition("AUTO");

        if (cancellation.kind === "NO_APPOINTMENTS") {
          response = {
            reply_text: "Você não possui agendamentos ativos para cancelamento.",
            conversation_state: conversation.state,
            patient_state: patient.state,
          };
        } else if (cancellation.kind === "NEEDS_CLARIFICATION") {
          const optionsText = cancellation.options
            .map((item, i) => `${i + 1}) ${item.starts_at_iso} - ${item.service_code} com ${item.professional_name}`)
            .join("; ");

          response = {
            reply_text: `Encontrei mais de um agendamento. Qual você deseja cancelar? ${optionsText}`,
            conversation_state: conversation.state,
            patient_state: patient.state,
          };
        } else {
          response = {
            reply_text: `Agendamento cancelado: ${cancellation.appointment.starts_at_iso} (${cancellation.appointment.service_code}).`,
            conversation_state: conversation.state,
            patient_state: patient.state,
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
          requested_datetime_iso: interpretation.entities.datetime_iso,
          now: new Date(),
        });

        conversation.transition("AUTO");

        if (confirmation.kind === "NO_APPOINTMENTS") {
          response = {
            reply_text: "Não encontrei agendamento pendente para confirmar presença.",
            conversation_state: conversation.state,
            patient_state: patient.state,
          };
        } else if (confirmation.kind === "NEEDS_CLARIFICATION") {
          const optionsText = confirmation.options
            .map((item, i) => `${i + 1}) ${item.starts_at_iso} - ${item.service_code} com ${item.professional_name}`)
            .join("; ");

          response = {
            reply_text: `Você possui mais de um agendamento. Qual deseja confirmar? ${optionsText}`,
            conversation_state: conversation.state,
            patient_state: patient.state,
          };
        } else {
          response = {
            reply_text: `Presença confirmada para ${confirmation.appointment.starts_at_iso}.`,
            conversation_state: conversation.state,
            patient_state: patient.state,
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
        response = {
          reply_text: clinicSettings
            ? resolveTemplate(clinicSettings, "escalate_human")
            : "Sem problema! Vou te passar pra um dos nossos atendentes agora. Só um minutinho.",
          conversation_state: conversation.state,
          patient_state: patient.state,
        };
        break;

      default:
        conversation.transition("AUTO");
        response = {
          reply_text: this.buildUnknownResponse(interpretation, clinicSettings, conversation.attempts),
          conversation_state: conversation.state,
          patient_state: patient.state,
        };
        break;
    }

    // 10b. Apply conversational acknowledgment prefix (deterministic fallback).
    // Only used when LLM response generator is NOT available — the LLM
    // handles acknowledgment natively via signals passed to composeResponse.
    if (!this.responseGenerator) {
      const ackPrefix = buildAcknowledgmentPrefix(
        signals,
        effectiveIntent,
        conversation.attempts,
      );
      if (ackPrefix) {
        response = {
          ...response,
          reply_text: `${ackPrefix} ${response.reply_text}`,
        };
      }
    }

    // 11. Persist state
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

    // 12. Store processed inbound for idempotency
    await this.processedInboundRepository.save({
      channel: input.channel,
      externalUserId: input.external_user_id,
      messageId: input.message_id,
      conversationId: conversation.id,
      response,
    });

    return response;
  }

  private matchesOpeningPattern(text: string): boolean {
    const n = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const original = text.toLowerCase();
    return OPENING_PATTERNS.some((p) => p.test(original) || p.test(n));
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
    if (llmIntent === "UNKNOWN" && currentConversationIntent && isIntentTransactional(currentConversationIntent)) {
      return currentConversationIntent;
    }

    if (isIntentTransactional(llmIntent)) {
      return llmIntent;
    }

    if (isIntentInformational(llmIntent)) {
      return llmIntent;
    }

    return llmIntent;
  }

  private async handleGreeting(
    clinicSettings: ClinicSettings | null,
    catalogSnapshot: { services: Array<{ service_code: string; name: string; duration_min: number }> },
    patientState: string,
    userMessage: string,
    signals: ConversationalSignals,
  ): Promise<ProcessedInboundResponse> {
    const clinicName = clinicSettings?.clinicDisplayName ?? "Dentzi";
    const botName = clinicSettings?.botName ?? "Assistente";

    // First interaction: just greet, present yourself, ask how to help.
    // Do NOT dump the service list — let the patient say what they need.
    let replyText: string;
    if (this.responseGenerator && clinicSettings) {
      replyText = await composeResponse({
        generator: this.responseGenerator,
        settings: clinicSettings,
        templateKey: "greeting",
        facts: [
          `Você atende pela clínica ${clinicName}`,
          "Retribua a saudação do paciente",
          "Pergunte em que pode ajudar",
        ],
        userMessage,
        isFirstTurn: true,
        signals,
      });
    } else {
      replyText = clinicSettings
        ? resolveTemplate(clinicSettings, "greeting")
        : `Olá! Aqui é da ${clinicName}. Em que posso te ajudar?`;
    }

    return {
      reply_text: replyText,
      conversation_state: "AUTO",
      patient_state: patientState,
    };
  }

  private handleSmallTalk(
    catalogSnapshot: { services: Array<{ service_code: string; name: string; duration_min: number }> },
    patientState: string,
  ): ProcessedInboundResponse {
    return {
      reply_text:
        "Claro, estou aqui pra te ajudar! Me conta o que você precisa — " +
        "posso agendar uma consulta, tirar dúvidas sobre algum procedimento, ou te passar pra um dos nossos atendentes.",
      conversation_state: "AUTO",
      patient_state: patientState,
    };
  }

  private handleListServices(
    catalogSnapshot: { services: Array<{ service_code: string; name: string; duration_min: number }> },
    patientState: string,
  ): ProcessedInboundResponse {
    if (catalogSnapshot.services.length === 0) {
      return {
        reply_text: "Puxa, não encontrei nenhum serviço cadastrado no momento. Quer que eu te passe pra um dos nossos atendentes?",
        conversation_state: "AUTO",
        patient_state: patientState,
      };
    }

    const servicesText = catalogSnapshot.services
      .map((s, i) => `  ${i + 1}) ${s.name} — duração de ${s.duration_min} min`)
      .join("\n");

    return {
      reply_text: `Trabalhamos com os seguintes procedimentos:\n\n${servicesText}\n\nTe interessa algum deles? Posso verificar os horários disponíveis.`,
      conversation_state: "AUTO",
      patient_state: patientState,
    };
  }

  private handleInformational(
    intent: LlmIntent,
    clinicSettings: ClinicSettings | null,
    catalogSnapshot: { services: Array<{ service_code: string; name: string; duration_min: number }> },
    patientState: string,
  ): ProcessedInboundResponse {
    let text: string;

    switch (intent) {
      case "CLINIC_INFO": {
        const name = clinicSettings?.clinicDisplayName ?? "Dentzi";
        text = `A ${name} é uma clínica odontológica com profissionais qualificados e atendimento humanizado. Em que posso te ajudar?`;
        break;
      }
      case "INSURANCE_INFO":
        text = "Sim! Atendemos tanto particular quanto por convênio. Quer que eu veja os horários disponíveis pra você?";
        break;
      case "HOURS_INFO": {
        const hours = clinicSettings
          ? `${clinicSettings.workingDaysText}, das ${clinicSettings.workingHoursText}`
          : "segunda a sexta, das 08:00 às 19:00";
        text = `Nosso horário de funcionamento é de ${hours}. Quer que eu verifique a disponibilidade pra você?`;
        break;
      }
      case "LOCATION_INFO":
        text = "Posso te passar o endereço e as informações de como chegar. Precisa de mais alguma coisa?";
        break;
      default:
        text = "Como posso te ajudar?";
    }

    return {
      reply_text: text,
      conversation_state: "AUTO",
      patient_state: patientState,
    };
  }

  private async handleServiceInfo(
    interpretation: LlmInterpretation,
    clinicId: string,
    catalogSnapshot: CatalogSnapshot,
    patient: { state: string },
    input: InboundMessageCommand,
  ): Promise<ProcessedInboundResponse> {
    const serviceCode = interpretation.entities.service_code;
    const matchedService = serviceCode
      ? catalogSnapshot.services.find((s) => s.service_code === serviceCode)
      : null;

    if (!matchedService) {
      const serviceNames = buildServiceListText(
        catalogSnapshot.services.map((s) => ({ name: s.name })),
      );
      return {
        reply_text: serviceNames
          ? `Posso te dar mais detalhes sobre qualquer um dos nossos procedimentos: ${serviceNames}. Qual te interessa?`
          : "Sobre qual procedimento você gostaria de saber?",
        conversation_state: "AUTO",
        patient_state: patient.state,
      };
    }

    // RAG: retrieve knowledge documents for this service
    const knowledgeContent = await this.retrieveServiceKnowledge(
      clinicId,
      matchedService.service_code,
      matchedService.name,
      input.text,
    );

    // Build the service info response
    let serviceDescription: string;

    if (knowledgeContent && this.responseGenerator) {
      // LLM + knowledge: compose a natural answer from retrieved documents
      serviceDescription = await composeResponse({
        generator: this.responseGenerator,
        settings: null,
        templateKey: "fallback",
        facts: [
          `Serviço: ${matchedService.name} (duração média: ${matchedService.duration_min} minutos)`,
          ...knowledgeContent.map((doc) => `${doc.title}: ${doc.content}`),
        ],
        userMessage: input.text,
        isFirstTurn: false,
        constraints: [
          "NÃO cumprimente. Vá direto à informação.",
          "Responda a pergunta do paciente usando o conhecimento fornecido.",
          "Não repita informação — sintetize de forma natural.",
          "Não cite títulos de documentos.",
        ],
      });
    } else if (knowledgeContent && knowledgeContent.length > 0) {
      // Knowledge found but no LLM: format documents directly
      const parts = [
        `A ${matchedService.name} é um procedimento que dura em média ${matchedService.duration_min} minutos.`,
        ...knowledgeContent.map((doc) => doc.content),
      ];
      serviceDescription = parts.join("\n\n");
    } else {
      // No knowledge: fallback to catalog-only
      serviceDescription = `A ${matchedService.name} é um procedimento que dura em média ${matchedService.duration_min} minutos.`;
    }

    // AVAILABILITY-FIRST: look up real availability
    const scheduling = await this.schedulingIntentUseCase.execute({
      clinic_id: clinicId,
      patient_id: "",
      conversation_id: "",
      patient_known_name: null,
      interpretation: {
        ...interpretation,
        intent: "BOOK_APPOINTMENT",
        entities: {
          ...interpretation.entities,
          service_code: matchedService.service_code,
        },
      },
      now: new Date(),
    });

    const replyText = `${serviceDescription}\n\n${scheduling.reply_text}`;

    return {
      reply_text: replyText,
      conversation_state: "AUTO",
      patient_state: patient.state,
    };
  }

  /**
   * Retrieve knowledge documents for a service.
   * Returns null if no knowledge port is available, empty array if no docs found.
   */
  private async retrieveServiceKnowledge(
    clinicId: string,
    serviceCode: string,
    serviceName: string,
    userMessage: string,
  ): Promise<Array<{ title: string; content: string }> | null> {
    if (!this.knowledgeRetrieval) return null;

    // Query by service code as category, with user message as search text
    const results = await this.knowledgeRetrieval.findRelevant({
      clinicId,
      category: serviceCode,
      searchText: serviceName,
      limit: 5,
    });

    if (results.length === 0) {
      // Try broader search with just the service name
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

  /**
   * Build the UNKNOWN intent response with escalation after max attempts.
   */
  private buildUnknownResponse(
    interpretation: LlmInterpretation,
    clinicSettings: ClinicSettings | null,
    attempts: number,
  ): string {
    const maxUnknown = clinicSettings?.maxUnknownBeforeFallback ?? 3;

    if (attempts >= maxUnknown) {
      return clinicSettings
        ? resolveTemplate(clinicSettings, "fallback")
        : "Desculpa, não consegui entender. Quer que eu te passe pra um dos nossos atendentes?";
    }

    return (
      interpretation.suggested_next_question ||
      "Desculpa, não entendi bem. Pode me explicar de outra forma? Posso te ajudar com agendamento, tirar dúvidas sobre procedimentos, ou te passar pra um atendente."
    );
  }
}
