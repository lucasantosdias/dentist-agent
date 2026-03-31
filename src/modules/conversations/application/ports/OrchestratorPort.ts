import type { InboundMessageCommand } from "@/modules/conversations/application/dto/InboundMessageCommand";
import type { ProcessedInboundResponse } from "@/modules/conversations/application/ports/ProcessedInboundRepositoryPort";

/**
 * Shared interface for both ConversationOrchestrator (classic) and AgentOrchestrator (agent).
 * Allows the container to expose a single orchestrator regardless of mode.
 */
export interface OrchestratorPort {
  execute(clinicId: string, input: InboundMessageCommand): Promise<ProcessedInboundResponse>;
}
