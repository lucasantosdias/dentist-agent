import type { SchedulingAvailabilityPort } from "@/modules/scheduling/application/ports/SchedulingAvailabilityPort";
import type { TimeSlot } from "@/modules/scheduling/application/dto/SchedulingDtos";
import type { SchedulingPolicies } from "@/modules/scheduling/domain/SchedulingPolicies";
import { roundUpToStep } from "@/shared/time";

export type ProposeSlotsInput = {
  professionalId: string;
  serviceDurationMin: number;
  requestedStartsAt: Date | null;
  now: Date;
  limit?: number;
};

export class ProposeSlotsUseCase {
  constructor(
    private readonly availabilityPort: SchedulingAvailabilityPort,
    private readonly policies: SchedulingPolicies,
  ) {}

  async execute(input: ProposeSlotsInput): Promise<TimeSlot[]> {
    const limit = input.limit ?? 3;
    const slots: TimeSlot[] = [];

    if (input.requestedStartsAt) {
      const requestedEnd = new Date(input.requestedStartsAt.getTime() + input.serviceDurationMin * 60_000);
      const available = await this.availabilityPort.isSlotAvailable({
        professionalId: input.professionalId,
        startsAt: input.requestedStartsAt,
        endsAt: requestedEnd,
        now: input.now,
      });

      if (available && this.policies.isWithinWorkingHours(input.requestedStartsAt, requestedEnd)) {
        slots.push({ startsAt: input.requestedStartsAt, endsAt: requestedEnd });
      }
    }

    let cursor = roundUpToStep(
      input.requestedStartsAt && input.requestedStartsAt.getTime() > input.now.getTime()
        ? input.requestedStartsAt
        : input.now,
      this.policies.stepMinutes,
    );

    let guard = 0;
    while (slots.length < limit && guard < 300) {
      const candidateEnd = new Date(cursor.getTime() + input.serviceDurationMin * 60_000);
      if (this.policies.isWithinWorkingHours(cursor, candidateEnd)) {
        const available = await this.availabilityPort.isSlotAvailable({
          professionalId: input.professionalId,
          startsAt: cursor,
          endsAt: candidateEnd,
          now: input.now,
        });

        if (available) {
          const exists = slots.some((slot) => slot.startsAt.getTime() === cursor.getTime());
          if (!exists) {
            slots.push({ startsAt: cursor, endsAt: candidateEnd });
          }
        }
      }

      cursor = new Date(cursor.getTime() + this.policies.stepMinutes * 60_000);
      guard += 1;
    }

    return slots;
  }
}
