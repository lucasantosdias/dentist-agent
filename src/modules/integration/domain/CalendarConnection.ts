export type CalendarProvider = "GOOGLE";

export type CalendarConnectionProps = {
  id: string;
  professionalId: string;
  provider: CalendarProvider;
  googleCalendarId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  lastSyncAt: Date | null;
};

export class CalendarConnection {
  constructor(private props: CalendarConnectionProps) {}

  get id(): string { return this.props.id; }
  get professionalId(): string { return this.props.professionalId; }
  get provider(): CalendarProvider { return this.props.provider; }
  get googleCalendarId(): string { return this.props.googleCalendarId; }
  get accessToken(): string { return this.props.accessToken; }
  get refreshToken(): string { return this.props.refreshToken; }
  get tokenExpiresAt(): Date { return this.props.tokenExpiresAt; }
  get lastSyncAt(): Date | null { return this.props.lastSyncAt; }

  isTokenExpired(now: Date): boolean {
    return now >= this.props.tokenExpiresAt;
  }

  updateTokens(accessToken: string, expiresAt: Date): void {
    this.props.accessToken = accessToken;
    this.props.tokenExpiresAt = expiresAt;
  }

  markSynced(at: Date): void {
    this.props.lastSyncAt = at;
  }

  toPrimitives(): CalendarConnectionProps {
    return { ...this.props };
  }
}
