/**
 * Port for Google Calendar API operations.
 * The integration module implements this via Google Calendar REST API.
 */

export type FreeBusySlot = {
  start: Date;
  end: Date;
};

export type FreeBusyResult = {
  calendarId: string;
  busySlots: FreeBusySlot[];
};

export type CalendarEvent = {
  id: string;
  summary: string | null;
  start: Date;
  end: Date;
  status: "confirmed" | "tentative" | "cancelled";
};

export type CreateEventInput = {
  calendarId: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timezone: string;
};

export type CreatedEvent = {
  eventId: string;
  htmlLink: string | null;
};

export type WatchChannelResult = {
  channelId: string;
  resourceId: string;
  expiration: Date;
};

export type IncrementalSyncResult = {
  events: CalendarEvent[];
  nextSyncToken: string;
};

export interface GoogleCalendarPort {
  freeBusy(
    accessToken: string,
    calendarId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<FreeBusyResult>;

  createEvent(
    accessToken: string,
    input: CreateEventInput,
  ): Promise<CreatedEvent>;

  watchCalendar(
    accessToken: string,
    calendarId: string,
    webhookUrl: string,
    channelId: string,
  ): Promise<WatchChannelResult>;

  incrementalSync(
    accessToken: string,
    calendarId: string,
    syncToken: string | null,
  ): Promise<IncrementalSyncResult>;

  refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt: Date }>;

  exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }>;
}
