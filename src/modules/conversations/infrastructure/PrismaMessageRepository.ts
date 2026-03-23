import type { PrismaClient } from "@prisma/client";

import type {
  CreateInboundMessageParams,
  CreateOutboundMessageParams,
  InboundInsertResult,
  MessageRepositoryPort,
} from "@/modules/conversations/application/ports/MessageRepositoryPort";
import { Message } from "@/modules/conversations/domain/Message";

function mapJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function mapMessage(row: {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  text: string;
  channel: string;
  externalUserId: string;
  externalMessageId: string | null;
  llmIntent: string | null;
  entitiesJson: unknown;
  createdAt: Date;
}): Message {
  return new Message({
    id: row.id,
    conversationId: row.conversationId,
    direction: row.direction,
    text: row.text,
    channel: row.channel,
    externalUserId: row.externalUserId,
    externalMessageId: row.externalMessageId,
    llmIntent: row.llmIntent,
    entitiesJson: mapJson(row.entitiesJson),
    createdAt: row.createdAt,
  });
}

export class PrismaMessageRepository implements MessageRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async createInbound(params: CreateInboundMessageParams): Promise<InboundInsertResult> {
    try {
      const row = await this.prisma.message.create({
        data: {
          conversationId: params.conversationId,
          direction: "INBOUND",
          text: params.text,
          channel: params.channel,
          externalUserId: params.externalUserId,
          externalMessageId: params.messageId,
          llmIntent: params.llmIntent ?? null,
          entitiesJson: params.entitiesJson as never,
        },
      });

      return { message: mapMessage(row), isDuplicate: false };
    } catch (error) {
      const typed = error as { code?: string };
      if (typed.code !== "P2002") {
        throw error;
      }

      const existing = await this.prisma.message.findUnique({
        where: {
          channel_externalUserId_externalMessageId: {
            channel: params.channel,
            externalUserId: params.externalUserId,
            externalMessageId: params.messageId,
          },
        },
      });

      if (!existing) {
        throw error;
      }

      return { message: mapMessage(existing), isDuplicate: true };
    }
  }

  async createOutbound(params: CreateOutboundMessageParams): Promise<Message> {
    const row = await this.prisma.message.create({
      data: {
        conversationId: params.conversationId,
        direction: "OUTBOUND",
        text: params.text,
        channel: params.channel,
        externalUserId: params.externalUserId,
        llmIntent: params.llmIntent ?? null,
        entitiesJson: params.entitiesJson as never,
      },
    });

    return mapMessage(row);
  }

  async listLastMessages(conversationId: string, limit: number): Promise<Message[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return rows.reverse().map(mapMessage);
  }

  async findLastOutbound(conversationId: string): Promise<Message | null> {
    const row = await this.prisma.message.findFirst({
      where: { conversationId, direction: "OUTBOUND" },
      orderBy: { createdAt: "desc" },
    });

    return row ? mapMessage(row) : null;
  }
}
