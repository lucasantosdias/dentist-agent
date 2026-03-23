export type AvailabilityExceptionSource = "MANUAL" | "GOOGLE_CALENDAR" | "SYSTEM";
export type AvailabilityExceptionStatus = "ACTIVE" | "CANCELLED";

export type AvailabilityExceptionProps = {
  id: string;
  professionalId: string;
  source: AvailabilityExceptionSource;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
  externalEventId: string | null;
  status: AvailabilityExceptionStatus;
};

export class AvailabilityException {
  constructor(private props: AvailabilityExceptionProps) {}

  get id(): string { return this.props.id; }
  get professionalId(): string { return this.props.professionalId; }
  get source(): AvailabilityExceptionSource { return this.props.source; }
  get startsAt(): Date { return this.props.startsAt; }
  get endsAt(): Date { return this.props.endsAt; }
  get reason(): string | null { return this.props.reason; }
  get externalEventId(): string | null { return this.props.externalEventId; }
  get status(): AvailabilityExceptionStatus { return this.props.status; }

  get isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  cancel(): void {
    this.props.status = "CANCELLED";
  }

  overlaps(startsAt: Date, endsAt: Date): boolean {
    return this.props.startsAt < endsAt && this.props.endsAt > startsAt;
  }

  toPrimitives(): AvailabilityExceptionProps {
    return { ...this.props };
  }
}
