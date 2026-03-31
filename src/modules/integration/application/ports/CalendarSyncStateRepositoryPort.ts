import type { CalendarSyncState } from "@/modules/integration/domain/CalendarSyncState";

export interface CalendarSyncStateRepositoryPort {
  findByProfessional(professionalId: string): Promise<CalendarSyncState | null>;
  upsert(professionalId: string, syncToken: string, lastSyncAt: Date): Promise<CalendarSyncState>;
  deleteByProfessional(professionalId: string): Promise<void>;
}
