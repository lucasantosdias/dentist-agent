export interface SchedulingAvailabilityPort {
  isSlotAvailable(input: {
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    now: Date;
    ignoreHoldId?: string;
  }): Promise<boolean>;
}
