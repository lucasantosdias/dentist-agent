import type { Conversation } from "@/modules/conversations/domain/Conversation";

export interface ConversationRepositoryPort {
  findLatestByPatientAndChannel(patientId: string, channel: string): Promise<Conversation | null>;
  create(clinicId: string, patientId: string, channel: string): Promise<Conversation>;
  save(conversation: Conversation): Promise<Conversation>;
  findById(id: string): Promise<Conversation | null>;
}
