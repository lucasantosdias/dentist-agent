import type { ConversationRepositoryPort } from "@/modules/conversations/application/ports/ConversationRepositoryPort";
import { Conversation } from "@/modules/conversations/domain/Conversation";
import { randomUUID } from "crypto";

export class InMemoryConversationRepository implements ConversationRepositoryPort {
  private conversations: Map<string, Conversation> = new Map();

  async findLatestByPatientAndChannel(
    patientId: string,
    channel: string,
  ): Promise<Conversation | null> {
    let latest: Conversation | null = null;
    for (const conv of this.conversations.values()) {
      const p = conv.toPrimitives();
      if (p.patientId === patientId && p.channel === channel) {
        if (!latest || (p.lastMessageAt && (!latest.lastMessageAt || p.lastMessageAt > latest.lastMessageAt))) {
          latest = conv;
        }
      }
    }
    return latest;
  }

  async create(clinicId: string, patientId: string, channel: string): Promise<Conversation> {
    const conversation = new Conversation({
      id: randomUUID(),
      clinicId,
      patientId,
      channel,
      state: "AUTO",
      attempts: 0,
      currentIntent: null,
      collectedData: {},
      missingRequirements: [],
      currentFunnelStep: null,
      lastMessageAt: null,
    });
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async save(conversation: Conversation): Promise<Conversation> {
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async findById(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) ?? null;
  }

  /** Test helper */
  getAll(): Conversation[] {
    return Array.from(this.conversations.values());
  }

  clear(): void {
    this.conversations.clear();
  }
}
