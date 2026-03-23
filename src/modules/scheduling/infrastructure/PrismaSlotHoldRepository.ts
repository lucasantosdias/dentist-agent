import type { PrismaClient, SlotHold as PrismaSlotHold } from "@prisma/client";

import type {
  CreateSlotHoldInput,
  SlotHoldRepositoryPort,
} from "@/modules/scheduling/application/ports/SlotHoldRepositoryPort";
import { SlotHold } from "@/modules/scheduling/domain/SlotHold";
import type { SlotHoldStatus } from "@/modules/scheduling/domain/SlotHoldStatus";

function mapHold(row: PrismaSlotHold): SlotHold {
  return new SlotHold({
    id: row.id,
    conversationId: row.conversationId,
    patientId: row.patientId,
    professionalId: row.professionalId,
    serviceId: row.serviceId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status as SlotHoldStatus,
    expiresAt: row.expiresAt,
  });
}

export class PrismaSlotHoldRepository implements SlotHoldRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateSlotHoldInput): Promise<SlotHold> {
    const row = await this.prisma.slotHold.create({
      data: {
        clinicId: input.clinicId,
        conversationId: input.conversationId,
        patientId: input.patientId,
        professionalId: input.professionalId,
        serviceId: input.serviceId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        expiresAt: input.expiresAt,
        status: "HELD",
      },
    });

    return mapHold(row);
  }

  async save(hold: SlotHold): Promise<SlotHold> {
    const data = hold.toPrimitives();
    const row = await this.prisma.slotHold.update({
      where: { id: data.id },
      data: {
        status: data.status,
        expiresAt: data.expiresAt,
      },
    });

    return mapHold(row);
  }

  async expireHeldBefore(date: Date): Promise<number> {
    const result = await this.prisma.slotHold.updateMany({
      where: {
        status: "HELD",
        expiresAt: { lte: date },
      },
      data: { status: "EXPIRED" },
    });

    return result.count;
  }

  async releaseHeldByConversation(conversationId: string): Promise<void> {
    await this.prisma.slotHold.updateMany({
      where: { conversationId, status: "HELD" },
      data: { status: "RELEASED" },
    });
  }

  async findActiveByConversation(conversationId: string, now: Date): Promise<SlotHold | null> {
    const row = await this.prisma.slotHold.findFirst({
      where: {
        conversationId,
        status: "HELD",
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    return row ? mapHold(row) : null;
  }

  async listOverlappingActive(
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
    now: Date,
    ignoreHoldId?: string,
  ): Promise<SlotHold[]> {
    const rows = await this.prisma.slotHold.findMany({
      where: {
        professionalId,
        status: "HELD",
        expiresAt: { gt: now },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(ignoreHoldId ? { id: { not: ignoreHoldId } } : {}),
      },
    });

    return rows.map(mapHold);
  }
}
