import type { AvailabilityRuleRepositoryPort } from "@/modules/scheduling/application/ports/AvailabilityRuleRepositoryPort";
import type { AvailabilityExceptionRepositoryPort } from "@/modules/scheduling/application/ports/AvailabilityExceptionRepositoryPort";
import type { SchedulingAvailabilityPort } from "@/modules/scheduling/application/ports/SchedulingAvailabilityPort";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { GoogleCalendarPort } from "@/modules/integration/application/ports/GoogleCalendarPort";
import type { CalendarConnectionRepositoryPort } from "@/modules/integration/application/ports/CalendarConnectionRepositoryPort";
import type { TimeSlot } from "@/modules/scheduling/application/dto/SchedulingDtos";
import { generateCandidateSlots } from "@/modules/scheduling/domain/SlotGenerator";

export type GenerateAvailableSlotsInput = {
  serviceId: string;
  professionalId: string;
  targetDate: Date;
  now: Date;
  limit?: number;
};

export type GenerateAvailableSlotsError =
  | "SERVICE_NOT_FOUND"
  | "PROFESSIONAL_NOT_FOUND"
  | "PROFESSIONAL_CANNOT_PERFORM_SERVICE"
  | "NO_AVAILABILITY_RULES";

export class GenerateAvailableSlotsUseCase {
  constructor(
    private readonly catalogRepo: CatalogRepositoryPort,
    private readonly ruleRepo: AvailabilityRuleRepositoryPort,
    private readonly exceptionRepo: AvailabilityExceptionRepositoryPort,
    private readonly availabilityPort: SchedulingAvailabilityPort,
    private readonly calendarConnectionRepo: CalendarConnectionRepositoryPort,
    private readonly googleCalendar: GoogleCalendarPort | null,
    private readonly timezoneOffsetMinutes: number,
  ) {}

  async execute(
    input: GenerateAvailableSlotsInput,
  ): Promise<{ ok: true; slots: TimeSlot[] } | { ok: false; error: GenerateAvailableSlotsError }> {
    const service = await this.catalogRepo.findServiceById(input.serviceId);
    if (!service) return { ok: false, error: "SERVICE_NOT_FOUND" };

    const professional = await this.catalogRepo.findProfessionalById(input.professionalId);
    if (!professional) return { ok: false, error: "PROFESSIONAL_NOT_FOUND" };

    const canPerform = await this.catalogRepo.professionalCanExecuteService(
      input.professionalId,
      input.serviceId,
    );
    if (!canPerform) return { ok: false, error: "PROFESSIONAL_CANNOT_PERFORM_SERVICE" };

    // Step 1: Load availability rules for the target day's weekday
    const localDate = new Date(input.targetDate.getTime() + this.timezoneOffsetMinutes * 60_000);
    const weekday = localDate.getUTCDay();

    const rules = await this.ruleRepo.findByProfessionalAndWeekday(input.professionalId, weekday);
    if (rules.length === 0) return { ok: false, error: "NO_AVAILABILITY_RULES" };

    // Step 2: Generate candidate slots from rules
    const candidates = generateCandidateSlots(
      rules,
      input.targetDate,
      service.durationMinutes,
      this.timezoneOffsetMinutes,
    );

    // Filter out past slots
    const futureCandidates = candidates.filter((s) => s.startsAt > input.now);
    if (futureCandidates.length === 0) return { ok: true, slots: [] };

    // Step 3: Load exceptions for the day range
    const dayStart = futureCandidates[0].startsAt;
    const dayEnd = futureCandidates[futureCandidates.length - 1].endsAt;

    const exceptions = await this.exceptionRepo.findActiveByProfessionalAndRange(
      input.professionalId,
      dayStart,
      dayEnd,
    );

    // Step 4: Filter out slots that overlap with exceptions
    let available = futureCandidates.filter(
      (slot) => !exceptions.some((ex) => ex.overlaps(slot.startsAt, slot.endsAt)),
    );

    // Step 5: Filter out slots conflicting with appointments and holds
    const availableAfterConflicts: TimeSlot[] = [];
    for (const slot of available) {
      const isFree = await this.availabilityPort.isSlotAvailable({
        professionalId: input.professionalId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        now: input.now,
      });
      if (isFree) availableAfterConflicts.push(slot);
    }
    available = availableAfterConflicts;

    // Step 6: Check Google Calendar free/busy
    if (this.googleCalendar && available.length > 0) {
      available = await this.filterByGoogleCalendar(
        input.professionalId,
        available,
        dayStart,
        dayEnd,
      );
    }

    const limit = input.limit ?? 10;
    return { ok: true, slots: available.slice(0, limit) };
  }

  private async filterByGoogleCalendar(
    professionalId: string,
    slots: TimeSlot[],
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<TimeSlot[]> {
    if (!this.googleCalendar) return slots;

    const connection = await this.calendarConnectionRepo.findByProfessional(professionalId);
    if (!connection) return slots;

    let accessToken = connection.accessToken;

    // Refresh token if expired
    if (connection.isTokenExpired(new Date())) {
      try {
        const refreshed = await this.googleCalendar.refreshAccessToken(connection.refreshToken);
        connection.updateTokens(refreshed.accessToken, refreshed.expiresAt);
        accessToken = refreshed.accessToken;
      } catch {
        console.warn(`Failed to refresh Google token for professional ${professionalId}`);
        return slots; // Graceful degradation: return slots without Google check
      }
    }

    try {
      const result = await this.googleCalendar.freeBusy(
        accessToken,
        connection.googleCalendarId,
        rangeStart,
        rangeEnd,
      );

      return slots.filter(
        (slot) =>
          !result.busySlots.some(
            (busy) => busy.start < slot.endsAt && busy.end > slot.startsAt,
          ),
      );
    } catch {
      console.warn(`Google freeBusy check failed for professional ${professionalId}`);
      return slots; // Graceful degradation
    }
  }
}
