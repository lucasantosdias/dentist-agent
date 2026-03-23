export type ProcessedInboundResponse = {
  reply_text: string;
  conversation_state: string;
  patient_state: string;
  appointment?: {
    id: string;
    status: string;
    starts_at: string | Date;
    ends_at: string | Date;
    professional_name: string;
    service_code: string;
  };
};

export type ProcessedInboundMessageRecord = {
  id: string;
  channel: string;
  externalUserId: string;
  messageId: string;
  conversationId: string | null;
  response: ProcessedInboundResponse;
};

export interface ProcessedInboundRepositoryPort {
  findByUniqueKey(
    channel: string,
    externalUserId: string,
    messageId: string,
  ): Promise<ProcessedInboundMessageRecord | null>;
  save(record: {
    channel: string;
    externalUserId: string;
    messageId: string;
    conversationId: string | null;
    response: ProcessedInboundResponse;
  }): Promise<void>;
}
