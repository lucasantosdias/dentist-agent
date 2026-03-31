import type { CalendarConnectionRepositoryPort } from "@/modules/integration/application/ports/CalendarConnectionRepositoryPort";
import type { CalendarWatchChannelRepositoryPort } from "@/modules/integration/application/ports/CalendarWatchChannelRepositoryPort";
import type { CalendarSyncStateRepositoryPort } from "@/modules/integration/application/ports/CalendarSyncStateRepositoryPort";
import type { AvailabilityExceptionRepositoryPort } from "@/modules/scheduling/application/ports/AvailabilityExceptionRepositoryPort";
import type { Result } from "@/shared/result";
import { ok } from "@/shared/result";

export class DisconnectGoogleCalendarUseCase {
  constructor(
    private readonly connectionRepo: CalendarConnectionRepositoryPort,
    private readonly watchChannelRepo: CalendarWatchChannelRepositoryPort,
    private readonly syncStateRepo: CalendarSyncStateRepositoryPort,
    private readonly exceptionRepo: AvailabilityExceptionRepositoryPort,
  ) {}

  async execute(professionalId: string): Promise<Result<{ cancelled: number }, never>> {
    // 1. Delete watch channels
    await this.watchChannelRepo.deleteByProfessional(professionalId);

    // 2. Delete sync state
    await this.syncStateRepo.deleteByProfessional(professionalId);

    // 3. Cancel Google Calendar exceptions
    const cancelled = await this.exceptionRepo.cancelAllByProfessionalAndSource(
      professionalId,
      "GOOGLE_CALENDAR",
    );

    // 4. Delete calendar connection
    await this.connectionRepo.deleteByProfessional(professionalId);

    return ok({ cancelled });
  }
}
