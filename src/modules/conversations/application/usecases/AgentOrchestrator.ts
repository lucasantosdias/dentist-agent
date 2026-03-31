import type { AgentExecutorPort, AgentMessage } from "@/modules/ai/application/ports/AgentExecutorPort";
import type { ClinicSettingsPort } from "@/modules/clinic/application/ports/ClinicSettingsPort";
import type { InboundMessageCommand } from "@/modules/conversations/application/dto/InboundMessageCommand";
import type { ConversationRepositoryPort } from "@/modules/conversations/application/ports/ConversationRepositoryPort";
import type {
  CancellationHandlerPort,
  CatalogSnapshotPort,
  ConfirmPresenceHandlerPort,
  RescheduleHandlerPort,
} from "@/modules/conversations/application/ports/IntentHandlerPorts";
import type { MessageRepositoryPort } from "@/modules/conversations/application/ports/MessageRepositoryPort";
import type { OrchestratorPort } from "@/modules/conversations/application/ports/OrchestratorPort";
import type {
  ProcessedInboundRepositoryPort,
  ProcessedInboundResponse,
} from "@/modules/conversations/application/ports/ProcessedInboundRepositoryPort";
import type { KnowledgeRetrievalPort } from "@/modules/knowledge/application/ports/KnowledgeRetrievalPort";
import type { PatientRepositoryPort } from "@/modules/patients/application/ports/PatientRepositoryPort";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { LookupAvailabilityUseCase } from "@/modules/scheduling/application/usecases/LookupAvailabilityUseCase";
import type { CreateHoldUseCase } from "@/modules/scheduling/application/usecases/CreateHoldUseCase";
import type { ConfirmAppointmentUseCase } from "@/modules/scheduling/application/usecases/ConfirmAppointmentUseCase";
import type { AgentToolDefinition } from "@/modules/ai/domain/AgentTool";
import { ToolExecutor } from "@/modules/ai/infrastructure/tools/ToolExecutor";
import { AGENT_TOOLS } from "@/modules/ai/infrastructure/tools/ToolRegistry";
import { buildAgentSystemPrompt } from "@/modules/ai/infrastructure/prompts/agentSystemPrompt";
import { resolveCanonicalPatient } from "@/modules/patients/domain/PatientIdentityResolver";

const MAX_AGENT_ITERATIONS = 5;

/**
 * Agent-based orchestrator.
 *
 * Thin deterministic wrapper that handles safety-critical operations
 * (idempotency, identity, persistence) and delegates conversational
 * reasoning to an LLM agent with tool calling.
 */
export class AgentOrchestrator implements OrchestratorPort {
  constructor(
    private readonly processedInboundRepository: ProcessedInboundRepositoryPort,
    private readonly patientRepository: PatientRepositoryPort,
    private readonly conversationRepository: ConversationRepositoryPort,
    private readonly messageRepository: MessageRepositoryPort,
    private readonly catalogSnapshotPort: CatalogSnapshotPort,
    private readonly catalogRepository: CatalogRepositoryPort,
    private readonly agentExecutor: AgentExecutorPort,
    private readonly lookupAvailability: LookupAvailabilityUseCase,
    private readonly createHold: CreateHoldUseCase,
    private readonly confirmAppointment: ConfirmAppointmentUseCase,
    private readonly cancelAppointment: CancellationHandlerPort,
    private readonly confirmPresence: ConfirmPresenceHandlerPort,
    private readonly messageContextLimit: number,
    private readonly clinicSettingsPort?: ClinicSettingsPort | null,
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
    if (existing) return existing.response;

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
        input.channel, input.external_user_id, input.message_id,
      );
      if (replay) return replay.response;

      const lastOutbound = await this.messageRepository.findLastOutbound(conversation.id);
      if (lastOutbound) {
        return { reply_text: lastOutbound.text, conversation_state: conversation.state, patient_state: patient.state };
      }
    }

    conversation.touchMessage();

    // 5. Load context
    const [recentMessages, catalogSnapshot, clinicSettings] = await Promise.all([
      this.messageRepository.listLastMessages(conversation.id, this.messageContextLimit),
      this.catalogSnapshotPort.execute(clinicId),
      this.clinicSettingsPort?.findByClinicId(clinicId) ?? Promise.resolve(null),
    ]);

    // 6. Deterministic CPF extraction and identity resolution
    const cpfMatch = input.text.match(/\b(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2})\b/)
      || input.text.match(/\b(\d{11})\b/);
    if (cpfMatch) {
      const digits = cpfMatch[1].replace(/\D/g, "");
      if (digits.length === 11 && digits !== patient.cpf) {
        patient.setCpf(digits);
      }
    }

    let allPatientIds = [patient.id];
    if (patient.cpf) {
      const cpfMatches = await this.patientRepository.findByCpfAndClinic(clinicId, patient.cpf);
      if (cpfMatches.length > 0) {
        const resolved = resolveCanonicalPatient(cpfMatches);
        if (resolved) allPatientIds = resolved.allPatientIds;
      }
    }

    // 7. Build agent messages
    const systemPrompt = buildAgentSystemPrompt({
      clinicSettings,
      catalog: catalogSnapshot,
      patientName: patient.fullName,
      patientCpf: patient.cpf,
      collectedData: conversation.collectedData as Record<string, unknown>,
      conversationTurnCount: conversation.attempts,
    });

    const agentMessages: AgentMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history
    for (const msg of recentMessages) {
      agentMessages.push({
        role: msg.direction === "INBOUND" ? "user" : "assistant",
        content: msg.text,
      });
    }

    // Add current user message (if not already in history)
    const lastHistoryMsg = recentMessages[recentMessages.length - 1];
    const currentAlreadyInHistory = lastHistoryMsg
      && lastHistoryMsg.direction === "INBOUND"
      && lastHistoryMsg.text === input.text;
    if (!currentAlreadyInHistory) {
      agentMessages.push({ role: "user", content: input.text });
    }

    // 8. Create tool executor with all dependencies
    const toolExecutor = new ToolExecutor({
      clinicId,
      patientId: patient.id,
      conversationId: conversation.id,
      allPatientIds,
      catalogSnapshot: this.catalogSnapshotPort,
      catalogRepository: this.catalogRepository,
      knowledgeRetrieval: this.knowledgeRetrieval ?? null,
      clinicSettings: this.clinicSettingsPort ?? null,
      lookupAvailability: this.lookupAvailability,
      createHold: this.createHold,
      confirmAppointment: this.confirmAppointment,
      cancelAppointment: this.cancelAppointment,
      confirmPresence: this.confirmPresence,
      rescheduleAppointment: this.rescheduleUseCase ?? null,
    });

    // 9. Run agent loop
    const agentResult = await this.agentExecutor.execute(
      agentMessages,
      AGENT_TOOLS as AgentToolDefinition[],
      MAX_AGENT_ITERATIONS,
      (call) => toolExecutor.execute(call),
    );

    // 10. Post-loop: derive state from tool calls
    let conversationState: "AUTO" | "WAITING" | "HUMAN" = "AUTO";
    let appointmentData: ProcessedInboundResponse["appointment"] | undefined;

    for (const tc of agentResult.tool_calls_log) {
      if (tc.name === "escalate_to_human" && (tc.result as { escalated?: boolean }).escalated) {
        conversationState = "HUMAN";
      }
      if (tc.name === "reserve_slot" && (tc.result as { reserved?: boolean }).reserved) {
        conversationState = "WAITING";
      }
      if (tc.name === "confirm_appointment" && (tc.result as { confirmed?: boolean }).confirmed) {
        conversationState = "AUTO";
        const apt = (tc.result as { appointment?: Record<string, string> }).appointment;
        if (apt) {
          appointmentData = {
            id: apt.id,
            status: "CONFIRMED",
            starts_at: apt.starts_at,
            ends_at: apt.ends_at,
            professional_name: apt.professional_name,
            service_code: apt.service_code,
          };
          patient.activate();
        }
      }
      // Extract patient name from confirm_appointment args
      if (tc.name === "confirm_appointment" && tc.arguments.patient_name) {
        const name = String(tc.arguments.patient_name).trim();
        if (name && name !== patient.fullName) {
          patient.setFullName(name);
        }
      }
    }

    conversation.transition(conversationState);

    const response: ProcessedInboundResponse = {
      reply_text: agentResult.response_text,
      conversation_state: conversation.state,
      patient_state: patient.state,
      ...(appointmentData ? { appointment: appointmentData } : {}),
    };

    // 11. Persist state
    await Promise.all([
      this.patientRepository.save(patient),
      this.conversationRepository.save(conversation),
      this.messageRepository.createOutbound({
        conversationId: conversation.id,
        text: response.reply_text,
        channel: input.channel,
        externalUserId: input.external_user_id,
        llmIntent: "AGENT",
        entitiesJson: {},
      }),
    ]);

    // 12. Store processed inbound
    await this.processedInboundRepository.save({
      channel: input.channel,
      externalUserId: input.external_user_id,
      messageId: input.message_id,
      conversationId: conversation.id,
      response,
    });

    return response;
  }
}
