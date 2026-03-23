export type SchedulingPolicyConfig = {
  holdTtlMinutes: number;
  stepMinutes: number;
  workingHourStart: number;
  workingHourEnd: number;
  timezoneOffsetMinutes: number;
};

export class SchedulingPolicies {
  constructor(private readonly config: SchedulingPolicyConfig) {}

  get holdTtlMinutes(): number {
    return this.config.holdTtlMinutes;
  }

  get stepMinutes(): number {
    return this.config.stepMinutes;
  }

  get workingHourStart(): number {
    return this.config.workingHourStart;
  }

  get workingHourEnd(): number {
    return this.config.workingHourEnd;
  }

  get timezoneOffsetMinutes(): number {
    return this.config.timezoneOffsetMinutes;
  }

  isWithinWorkingHours(start: Date, end: Date): boolean {
    if (end.getTime() <= start.getTime()) {
      return false;
    }

    const startParts = this.getLocalDateParts(start);
    const endParts = this.getLocalDateParts(end);

    const sameDay =
      startParts.year === endParts.year &&
      startParts.month === endParts.month &&
      startParts.day === endParts.day;
    if (!sameDay) {
      return false;
    }

    const startMin = startParts.hour * 60 + startParts.minute;
    const endMin = endParts.hour * 60 + endParts.minute;
    const windowStart = this.config.workingHourStart * 60;
    const windowEnd = this.config.workingHourEnd * 60;

    return startMin >= windowStart && endMin <= windowEnd;
  }

  private getLocalDateParts(date: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  } {
    const shifted = new Date(date.getTime() + this.config.timezoneOffsetMinutes * 60_000);

    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
    };
  }
}
