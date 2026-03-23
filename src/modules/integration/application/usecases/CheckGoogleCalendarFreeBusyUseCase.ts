import type { CalendarConnectionRepositoryPort } from "@/modules/integration/application/ports/CalendarConnectionRepositoryPort";
import type { GoogleCalendarPort, FreeBusySlot } from "@/modules/integration/application/ports/GoogleCalendarPort";

export type CheckFreeBusyInput = {
  professionalId: string;
  timeMin: Date;
  timeMax: Date;
};

export type CheckFreeBusyResult = {
  available: boolean;
  busySlots: FreeBusySlot[];
};

export class CheckGoogleCalendarFreeBusyUseCase {
  constructor(
    private readonly connectionRepo: CalendarConnectionRepositoryPort,
    private readonly googleCalendar: GoogleCalendarPort,
  ) {}

  async execute(input: CheckFreeBusyInput): Promise<CheckFreeBusyResult> {
    const connection = await this.connectionRepo.findByProfessional(input.professionalId);
    if (!connection) {
      // No Google Calendar connected — assume available
      return { available: true, busySlots: [] };
    }

    let accessToken = connection.accessToken;

    if (connection.isTokenExpired(new Date())) {
      const refreshed = await this.googleCalendar.refreshAccessToken(connection.refreshToken);
      connection.updateTokens(refreshed.accessToken, refreshed.expiresAt);
      accessToken = refreshed.accessToken;
    }

    try {
      const result = await this.googleCalendar.freeBusy(
        accessToken,
        connection.googleCalendarId,
        input.timeMin,
        input.timeMax,
      );

      const conflicting = result.busySlots.filter(
        (busy) => busy.start < input.timeMax && busy.end > input.timeMin,
      );

      return {
        available: conflicting.length === 0,
        busySlots: conflicting,
      };
    } catch {
      console.warn(`Google freeBusy failed for professional ${input.professionalId}`);
      return { available: true, busySlots: [] }; // Graceful degradation
    }
  }
}
