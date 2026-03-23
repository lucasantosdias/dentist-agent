export type AvailabilityRuleProps = {
  id: string;
  professionalId: string;
  weekday: number; // 0=Sunday, 6=Saturday
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  slotDurationMinutes: number | null;
  locationId: string | null;
};

export class AvailabilityRule {
  constructor(private readonly props: AvailabilityRuleProps) {
    if (props.weekday < 0 || props.weekday > 6) {
      throw new Error(`Invalid weekday: ${props.weekday}`);
    }
    if (!AvailabilityRule.isValidTime(props.startTime) || !AvailabilityRule.isValidTime(props.endTime)) {
      throw new Error(`Invalid time format: ${props.startTime} - ${props.endTime}`);
    }
    if (props.startTime >= props.endTime) {
      throw new Error(`startTime must be before endTime: ${props.startTime} >= ${props.endTime}`);
    }
  }

  get id(): string { return this.props.id; }
  get professionalId(): string { return this.props.professionalId; }
  get weekday(): number { return this.props.weekday; }
  get startTime(): string { return this.props.startTime; }
  get endTime(): string { return this.props.endTime; }
  get slotDurationMinutes(): number | null { return this.props.slotDurationMinutes; }
  get locationId(): string | null { return this.props.locationId; }

  get startMinutes(): number {
    const [h, m] = this.props.startTime.split(":").map(Number);
    return h * 60 + m;
  }

  get endMinutes(): number {
    const [h, m] = this.props.endTime.split(":").map(Number);
    return h * 60 + m;
  }

  generateSlots(serviceDurationMinutes: number): Array<{ startMinutes: number; endMinutes: number }> {
    const step = this.props.slotDurationMinutes ?? serviceDurationMinutes;
    const slots: Array<{ startMinutes: number; endMinutes: number }> = [];
    let cursor = this.startMinutes;

    while (cursor + serviceDurationMinutes <= this.endMinutes) {
      slots.push({ startMinutes: cursor, endMinutes: cursor + serviceDurationMinutes });
      cursor += step;
    }

    return slots;
  }

  toPrimitives(): AvailabilityRuleProps {
    return { ...this.props };
  }

  private static isValidTime(time: string): boolean {
    return /^\d{2}:\d{2}$/.test(time);
  }
}
