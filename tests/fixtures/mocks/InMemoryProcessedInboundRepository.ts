import type {
  ProcessedInboundRepositoryPort,
  ProcessedInboundMessageRecord,
  ProcessedInboundResponse,
} from "@/modules/conversations/application/ports/ProcessedInboundRepositoryPort";
import { randomUUID } from "crypto";

export class InMemoryProcessedInboundRepository implements ProcessedInboundRepositoryPort {
  private records: ProcessedInboundMessageRecord[] = [];

  async findByUniqueKey(
    channel: string,
    externalUserId: string,
    messageId: string,
  ): Promise<ProcessedInboundMessageRecord | null> {
    return (
      this.records.find(
        (r) =>
          r.channel === channel &&
          r.externalUserId === externalUserId &&
          r.messageId === messageId,
      ) ?? null
    );
  }

  async save(record: {
    channel: string;
    externalUserId: string;
    messageId: string;
    conversationId: string | null;
    response: ProcessedInboundResponse;
  }): Promise<void> {
    this.records.push({
      id: randomUUID(),
      ...record,
    });
  }

  clear(): void {
    this.records = [];
  }
}
