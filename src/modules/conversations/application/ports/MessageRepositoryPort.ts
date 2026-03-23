import type { Message } from "@/modules/conversations/domain/Message";

export type CreateInboundMessageParams = {
  conversationId: string;
  text: string;
  channel: string;
  externalUserId: string;
  messageId: string;
  llmIntent?: string;
  entitiesJson?: Record<string, unknown>;
};

export type CreateOutboundMessageParams = {
  conversationId: string;
  text: string;
  channel: string;
  externalUserId: string;
  llmIntent?: string;
  entitiesJson?: Record<string, unknown>;
};

export type InboundInsertResult = {
  message: Message;
  isDuplicate: boolean;
};

export interface MessageRepositoryPort {
  createInbound(params: CreateInboundMessageParams): Promise<InboundInsertResult>;
  createOutbound(params: CreateOutboundMessageParams): Promise<Message>;
  listLastMessages(conversationId: string, limit: number): Promise<Message[]>;
  findLastOutbound(conversationId: string): Promise<Message | null>;
}
