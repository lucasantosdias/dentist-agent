export type CalendarWatchChannelProps = {
  id: string;
  professionalId: string;
  channelId: string;
  resourceId: string;
  expiration: Date;
};

export class CalendarWatchChannel {
  constructor(private readonly props: CalendarWatchChannelProps) {}

  get id(): string { return this.props.id; }
  get professionalId(): string { return this.props.professionalId; }
  get channelId(): string { return this.props.channelId; }
  get resourceId(): string { return this.props.resourceId; }
  get expiration(): Date { return this.props.expiration; }

  isExpired(now: Date): boolean {
    return now >= this.props.expiration;
  }

  toPrimitives(): CalendarWatchChannelProps {
    return { ...this.props };
  }
}
