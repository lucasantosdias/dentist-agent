import type {
  GoogleCalendarPort,
  FreeBusyResult,
  CreateEventInput,
  CreatedEvent,
  WatchChannelResult,
  IncrementalSyncResult,
  CalendarEvent,
} from "@/modules/integration/application/ports/GoogleCalendarPort";

const GOOGLE_API = "https://www.googleapis.com";

export type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  webhookBaseUrl: string;
};

export class GoogleCalendarAdapter implements GoogleCalendarPort {
  constructor(private readonly config: GoogleCalendarConfig) {}

  async freeBusy(
    accessToken: string,
    calendarId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<FreeBusyResult> {
    const response = await fetch(`${GOOGLE_API}/calendar/v3/freeBusy`, {
      method: "POST",
      headers: this.headers(accessToken),
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Google freeBusy failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as {
      calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
    };

    const calendarData = data.calendars?.[calendarId];
    const busySlots = (calendarData?.busy ?? []).map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }));

    return { calendarId, busySlots };
  }

  async createEvent(
    accessToken: string,
    input: CreateEventInput,
  ): Promise<CreatedEvent> {
    const response = await fetch(
      `${GOOGLE_API}/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
      {
        method: "POST",
        headers: this.headers(accessToken),
        body: JSON.stringify({
          summary: input.summary,
          description: input.description ?? "",
          start: {
            dateTime: input.start.toISOString(),
            timeZone: input.timezone,
          },
          end: {
            dateTime: input.end.toISOString(),
            timeZone: input.timezone,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Google createEvent failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as { id: string; htmlLink?: string };
    return { eventId: data.id, htmlLink: data.htmlLink ?? null };
  }

  async watchCalendar(
    accessToken: string,
    calendarId: string,
    webhookUrl: string,
    channelId: string,
  ): Promise<WatchChannelResult> {
    const response = await fetch(
      `${GOOGLE_API}/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: "POST",
        headers: this.headers(accessToken),
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookUrl,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Google watchCalendar failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as {
      id: string;
      resourceId: string;
      expiration: string;
    };

    return {
      channelId: data.id,
      resourceId: data.resourceId,
      expiration: new Date(Number(data.expiration)),
    };
  }

  async incrementalSync(
    accessToken: string,
    calendarId: string,
    syncToken: string | null,
  ): Promise<IncrementalSyncResult> {
    const events: CalendarEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken = "";

    do {
      const params = new URLSearchParams();
      if (syncToken && !pageToken) {
        params.set("syncToken", syncToken);
      }
      if (pageToken) {
        params.set("pageToken", pageToken);
      }
      if (!syncToken) {
        // Initial sync — fetch recent events
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        params.set("timeMin", oneMonthAgo.toISOString());
      }
      params.set("singleEvents", "true");
      params.set("maxResults", "250");

      const response = await fetch(
        `${GOOGLE_API}/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: this.headers(accessToken) },
      );

      if (response.status === 410) {
        // Sync token invalidated — do full sync
        return this.incrementalSync(accessToken, calendarId, null);
      }

      if (!response.ok) {
        throw new Error(`Google incrementalSync failed: ${response.status} ${await response.text()}`);
      }

      const data = await response.json() as {
        items?: Array<{
          id: string;
          summary?: string;
          status: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
        }>;
        nextPageToken?: string;
        nextSyncToken?: string;
      };

      for (const item of data.items ?? []) {
        const startStr = item.start?.dateTime ?? item.start?.date;
        const endStr = item.end?.dateTime ?? item.end?.date;
        if (!startStr || !endStr) continue;

        events.push({
          id: item.id,
          summary: item.summary ?? null,
          start: new Date(startStr),
          end: new Date(endStr),
          status: item.status as CalendarEvent["status"],
        });
      }

      pageToken = data.nextPageToken;
      if (data.nextSyncToken) {
        nextSyncToken = data.nextSyncToken;
      }
    } while (pageToken);

    return { events, nextSyncToken };
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      throw new Error(`Google refreshToken failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }
}
