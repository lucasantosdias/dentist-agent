export type CalendarSyncStateProps = {
  id: string;
  professionalId: string;
  syncToken: string;
  lastSyncAt: Date;
};

export class CalendarSyncState {
  constructor(private props: CalendarSyncStateProps) {}

  get id(): string { return this.props.id; }
  get professionalId(): string { return this.props.professionalId; }
  get syncToken(): string { return this.props.syncToken; }
  get lastSyncAt(): Date { return this.props.lastSyncAt; }

  updateSync(syncToken: string, at: Date): void {
    this.props.syncToken = syncToken;
    this.props.lastSyncAt = at;
  }

  toPrimitives(): CalendarSyncStateProps {
    return { ...this.props };
  }
}
