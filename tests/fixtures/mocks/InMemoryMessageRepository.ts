import type {
  MessageRepositoryPort,
  CreateInboundMessageParams,
  CreateOutboundMessageParams,
  InboundInsertResult,
} from "@/modules/conversations/application/ports/MessageRepositoryPort";
import { Message } from "@/modules/conversations/domain/Message";
import { randomUUID } from "crypto";

export class InMemoryMessageRepository implements MessageRepositoryPort {
  private messages: Message[] = [];
  private seenMessageIds = new Set<string>();

  async createInbound(params: CreateInboundMessageParams): Promise<InboundInsertResult> {
    if (this.seenMessageIds.has(params.messageId)) {
      const existing = this.messages.find(
        (m) => m.externalMessageId === params.messageId,
      )!;
      return { message: existing, isDuplicate: true };
    }

    this.seenMessageIds.add(params.messageId);

    const message = new Message({
      id: randomUUID(),
      conversationId: params.conversationId,
      direction: "INBOUND",
      text: params.text,
      channel: params.channel,
      externalUserId: params.externalUserId,
      externalMessageId: params.messageId,
      llmIntent: params.llmIntent ?? null,
      entitiesJson: params.entitiesJson ?? null,
      createdAt: new Date(),
    });

    this.messages.push(message);
    return { message, isDuplicate: false };
  }

  async createOutbound(params: CreateOutboundMessageParams): Promise<Message> {
    const message = new Message({
      id: randomUUID(),
      conversationId: params.conversationId,
      direction: "OUTBOUND",
      text: params.text,
      channel: params.channel,
      externalUserId: params.externalUserId,
      externalMessageId: null,
      llmIntent: params.llmIntent ?? null,
      entitiesJson: params.entitiesJson ?? null,
      createdAt: new Date(),
    });

    this.messages.push(message);
    return message;
  }

  async listLastMessages(conversationId: string, limit: number): Promise<Message[]> {
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .slice(-limit);
  }

  async findLastOutbound(conversationId: string): Promise<Message | null> {
    const outbound = this.messages.filter(
      (m) => m.conversationId === conversationId && m.direction === "OUTBOUND",
    );
    return outbound[outbound.length - 1] ?? null;
  }

  /** Test helpers */
  getAll(): Message[] {
    return [...this.messages];
  }

  getByConversation(conversationId: string): Message[] {
    return this.messages.filter((m) => m.conversationId === conversationId);
  }

  clear(): void {
    this.messages = [];
    this.seenMessageIds.clear();
  }
}
