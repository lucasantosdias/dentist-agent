import type { PrismaClient, Conversation as PrismaConversation } from "@prisma/client";

import type { ConversationRepositoryPort } from "@/modules/conversations/application/ports/ConversationRepositoryPort";
import { Conversation } from "@/modules/conversations/domain/Conversation";
import type { CollectedData } from "@/modules/conversations/domain/services/RequirementResolver";

function toEntity(row: PrismaConversation): Conversation {
  return new Conversation({
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    channel: row.channel,
    state: row.state,
    attempts: row.attempts,
    currentIntent: row.currentIntent,
    collectedData: (row.collectedDataJson as CollectedData) ?? {},
    missingRequirements: (row.missingRequirementsJson as string[]) ?? [],
    currentFunnelStep: row.currentFunnelStep,
    lastMessageAt: row.lastMessageAt,
  });
}

export class PrismaConversationRepository implements ConversationRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findLatestByPatientAndChannel(patientId: string, channel: string): Promise<Conversation | null> {
    const row = await this.prisma.conversation.findFirst({
      where: { patientId, channel },
      orderBy: { updatedAt: "desc" },
    });

    return row ? toEntity(row) : null;
  }

  async create(clinicId: string, patientId: string, channel: string): Promise<Conversation> {
    const row = await this.prisma.conversation.create({
      data: {
        clinicId,
        patientId,
        channel,
        state: "AUTO",
        collectedDataJson: {},
        missingRequirementsJson: [],
      },
    });

    return toEntity(row);
  }

  async save(conversation: Conversation): Promise<Conversation> {
    const data = conversation.toPrimitives();
    const row = await this.prisma.conversation.update({
      where: { id: data.id },
      data: {
        state: data.state,
        attempts: data.attempts,
        currentIntent: data.currentIntent,
        collectedDataJson: data.collectedData as never,
        missingRequirementsJson: data.missingRequirements,
        currentFunnelStep: data.currentFunnelStep,
        lastMessageAt: data.lastMessageAt,
      },
    });

    return toEntity(row);
  }

  async findById(id: string): Promise<Conversation | null> {
    const row = await this.prisma.conversation.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }
}
