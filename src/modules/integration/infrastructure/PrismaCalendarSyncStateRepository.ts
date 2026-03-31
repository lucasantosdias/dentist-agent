import type { PrismaClient, CalendarSyncState as PrismaSyncState } from "@prisma/client";
import type { CalendarSyncStateRepositoryPort } from "@/modules/integration/application/ports/CalendarSyncStateRepositoryPort";
import { CalendarSyncState } from "@/modules/integration/domain/CalendarSyncState";

function toDomain(row: PrismaSyncState): CalendarSyncState {
  return new CalendarSyncState({
    id: row.id,
    professionalId: row.professionalId,
    syncToken: row.syncToken,
    lastSyncAt: row.lastSyncAt,
  });
}

export class PrismaCalendarSyncStateRepository implements CalendarSyncStateRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProfessional(professionalId: string): Promise<CalendarSyncState | null> {
    const row = await this.prisma.calendarSyncState.findUnique({
      where: { professionalId },
    });
    return row ? toDomain(row) : null;
  }

  async upsert(professionalId: string, syncToken: string, lastSyncAt: Date): Promise<CalendarSyncState> {
    const row = await this.prisma.calendarSyncState.upsert({
      where: { professionalId },
      create: { professionalId, syncToken, lastSyncAt },
      update: { syncToken, lastSyncAt },
    });
    return toDomain(row);
  }

  async deleteByProfessional(professionalId: string): Promise<void> {
    await this.prisma.calendarSyncState.deleteMany({
      where: { professionalId },
    });
  }
}
