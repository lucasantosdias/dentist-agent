import type { PrismaClient } from "@prisma/client";

import type {
  ProcessedInboundMessageRecord,
  ProcessedInboundRepositoryPort,
  ProcessedInboundResponse,
} from "@/modules/conversations/application/ports/ProcessedInboundRepositoryPort";

function mapResponse(value: unknown): ProcessedInboundResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid processed inbound response payload");
  }

  return value as ProcessedInboundResponse;
}

export class PrismaProcessedInboundRepository implements ProcessedInboundRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUniqueKey(
    channel: string,
    externalUserId: string,
    messageId: string,
  ): Promise<ProcessedInboundMessageRecord | null> {
    const row = await this.prisma.processedInboundMessage.findUnique({
      where: {
        channel_externalUserId_messageId: {
          channel,
          externalUserId,
          messageId,
        },
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      channel: row.channel,
      externalUserId: row.externalUserId,
      messageId: row.messageId,
      conversationId: row.conversationId,
      response: mapResponse(row.response),
    };
  }

  async save(record: {
    channel: string;
    externalUserId: string;
    messageId: string;
    conversationId: string | null;
    response: ProcessedInboundResponse;
  }): Promise<void> {
    await this.prisma.processedInboundMessage.upsert({
      where: {
        channel_externalUserId_messageId: {
          channel: record.channel,
          externalUserId: record.externalUserId,
          messageId: record.messageId,
        },
      },
      update: {
        conversationId: record.conversationId,
        response: record.response as never,
      },
      create: {
        channel: record.channel,
        externalUserId: record.externalUserId,
        messageId: record.messageId,
        conversationId: record.conversationId,
        response: record.response as never,
      },
    });
  }
}
