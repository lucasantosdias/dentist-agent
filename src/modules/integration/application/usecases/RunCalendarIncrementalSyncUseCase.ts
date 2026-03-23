import type { CalendarConnectionRepositoryPort } from "@/modules/integration/application/ports/CalendarConnectionRepositoryPort";
import type { CalendarSyncStateRepositoryPort } from "@/modules/integration/application/ports/CalendarSyncStateRepositoryPort";
import type { GoogleCalendarPort, CalendarEvent } from "@/modules/integration/application/ports/GoogleCalendarPort";
import type { AvailabilityExceptionRepositoryPort } from "@/modules/scheduling/application/ports/AvailabilityExceptionRepositoryPort";
import type { AvailabilityRuleRepositoryPort } from "@/modules/scheduling/application/ports/AvailabilityRuleRepositoryPort";

export type RunCalendarIncrementalSyncInput = {
  professionalId: string;
};

export class RunCalendarIncrementalSyncUseCase {
  constructor(
    private readonly connectionRepo: CalendarConnectionRepositoryPort,
    private readonly syncStateRepo: CalendarSyncStateRepositoryPort,
    private readonly googleCalendar: GoogleCalendarPort,
    private readonly exceptionRepo: AvailabilityExceptionRepositoryPort,
    private readonly ruleRepo: AvailabilityRuleRepositoryPort,
    private readonly timezoneOffsetMinutes: number,
  ) {}

  async execute(input: RunCalendarIncrementalSyncInput): Promise<void> {
    const connection = await this.connectionRepo.findByProfessional(input.professionalId);
    if (!connection) {
      console.warn(`No calendar connection for professional ${input.professionalId}`);
      return;
    }

    let accessToken = connection.accessToken;

    // Refresh token if expired
    if (connection.isTokenExpired(new Date())) {
      const refreshed = await this.googleCalendar.refreshAccessToken(connection.refreshToken);
      connection.updateTokens(refreshed.accessToken, refreshed.expiresAt);
      await this.connectionRepo.save(connection);
      accessToken = refreshed.accessToken;
    }

    // Get current sync state
    const syncState = await this.syncStateRepo.findByProfessional(input.professionalId);
    const syncToken = syncState?.syncToken ?? null;

    // Perform incremental sync
    const syncResult = await this.googleCalendar.incrementalSync(
      accessToken,
      connection.googleCalendarId,
      syncToken,
    );

    // Load availability rules to determine clinic windows
    const rules = await this.ruleRepo.findByProfessional(input.professionalId);

    // Process changed events
    for (const event of syncResult.events) {
      await this.processEvent(input.professionalId, event, rules);
    }

    // Update sync state
    const now = new Date();
    await this.syncStateRepo.upsert(input.professionalId, syncResult.nextSyncToken, now);
    connection.markSynced(now);
    await this.connectionRepo.save(connection);
  }

  private async processEvent(
    professionalId: string,
    event: CalendarEvent,
    rules: Array<{ weekday: number; startMinutes: number; endMinutes: number }>,
  ): Promise<void> {
    // Only process events that conflict with clinic availability windows
    if (!this.conflictsWithClinicHours(event, rules)) return;

    const existing = await this.exceptionRepo.findByExternalEventId(professionalId, event.id);

    if (event.status === "cancelled") {
      // Event was cancelled — remove the exception
      if (existing?.isActive) {
        existing.cancel();
        await this.exceptionRepo.save(existing);
      }
      return;
    }

    if (existing) {
      // Event exists but may have changed time — cancel old and create new if different
      if (
        existing.startsAt.getTime() !== event.start.getTime() ||
        existing.endsAt.getTime() !== event.end.getTime()
      ) {
        existing.cancel();
        await this.exceptionRepo.save(existing);
        await this.exceptionRepo.create({
          professionalId,
          source: "GOOGLE_CALENDAR",
          startsAt: event.start,
          endsAt: event.end,
          reason: event.summary ?? "External calendar event",
          externalEventId: event.id,
        });
      }
      return;
    }

    // New event conflicting with clinic hours — create exception
    await this.exceptionRepo.create({
      professionalId,
      source: "GOOGLE_CALENDAR",
      startsAt: event.start,
      endsAt: event.end,
      reason: event.summary ?? "External calendar event",
      externalEventId: event.id,
    });
  }

  private conflictsWithClinicHours(
    event: CalendarEvent,
    rules: Array<{ weekday: number; startMinutes: number; endMinutes: number }>,
  ): boolean {
    const localStart = new Date(event.start.getTime() + this.timezoneOffsetMinutes * 60_000);
    const weekday = localStart.getUTCDay();

    const dayRules = rules.filter((r) => r.weekday === weekday);
    if (dayRules.length === 0) return false;

    const eventStartMin = localStart.getUTCHours() * 60 + localStart.getUTCMinutes();
    const localEnd = new Date(event.end.getTime() + this.timezoneOffsetMinutes * 60_000);
    const eventEndMin = localEnd.getUTCHours() * 60 + localEnd.getUTCMinutes();

    return dayRules.some(
      (rule) => eventStartMin < rule.endMinutes && eventEndMin > rule.startMinutes,
    );
  }
}
