import type { CalendarConnectionRepositoryPort } from "@/modules/integration/application/ports/CalendarConnectionRepositoryPort";
import type { GoogleCalendarPort } from "@/modules/integration/application/ports/GoogleCalendarPort";
import type { CalendarWatchChannelRepositoryPort } from "@/modules/integration/application/ports/CalendarWatchChannelRepositoryPort";
import type { CalendarSyncStateRepositoryPort } from "@/modules/integration/application/ports/CalendarSyncStateRepositoryPort";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { Result } from "@/shared/result";
import { ok, fail } from "@/shared/result";
import { randomUUID } from "crypto";

export type ConnectGoogleCalendarInput = {
  professionalId: string;
  googleCalendarId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
};

export type ConnectGoogleCalendarError = "PROFESSIONAL_NOT_FOUND";

export class ConnectGoogleCalendarUseCase {
  constructor(
    private readonly catalogRepo: CatalogRepositoryPort,
    private readonly connectionRepo: CalendarConnectionRepositoryPort,
    private readonly googleCalendar: GoogleCalendarPort,
    private readonly watchChannelRepo: CalendarWatchChannelRepositoryPort,
    private readonly syncStateRepo: CalendarSyncStateRepositoryPort,
    private readonly webhookBaseUrl: string,
  ) {}

  async execute(
    input: ConnectGoogleCalendarInput,
  ): Promise<Result<{ connectionId: string }, ConnectGoogleCalendarError>> {
    const professional = await this.catalogRepo.findProfessionalById(input.professionalId);
    if (!professional) return fail("PROFESSIONAL_NOT_FOUND");

    // 1. Save/update calendar connection
    const connection = await this.connectionRepo.upsert({
      professionalId: input.professionalId,
      provider: "GOOGLE",
      googleCalendarId: input.googleCalendarId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      tokenExpiresAt: input.tokenExpiresAt,
    });

    // 2. Set up watch channel for push notifications
    try {
      const channelId = randomUUID();
      const webhookUrl = `${this.webhookBaseUrl}/api/integrations/google-calendar/webhook`;

      const watchResult = await this.googleCalendar.watchCalendar(
        input.accessToken,
        input.googleCalendarId,
        webhookUrl,
        channelId,
      );

      // Clean up old channels
      await this.watchChannelRepo.deleteByProfessional(input.professionalId);

      await this.watchChannelRepo.create({
        professionalId: input.professionalId,
        channelId: watchResult.channelId,
        resourceId: watchResult.resourceId,
        expiration: watchResult.expiration,
      });
    } catch (error) {
      console.warn("Failed to set up watch channel:", error);
      // Connection is still valid; watch channel can be retried later
    }

    // 3. Perform initial sync to get sync token
    try {
      const syncResult = await this.googleCalendar.incrementalSync(
        input.accessToken,
        input.googleCalendarId,
        null,
      );

      await this.syncStateRepo.upsert(
        input.professionalId,
        syncResult.nextSyncToken,
        new Date(),
      );
    } catch (error) {
      console.warn("Failed initial calendar sync:", error);
    }

    return ok({ connectionId: connection.id });
  }
}
