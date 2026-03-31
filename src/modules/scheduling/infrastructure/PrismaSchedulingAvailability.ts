import type { PrismaClient } from "@prisma/client";

import type { SchedulingAvailabilityPort } from "@/modules/scheduling/application/ports/SchedulingAvailabilityPort";

export class PrismaSchedulingAvailability implements SchedulingAvailabilityPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly timezoneOffsetMinutes: number = -180, // São Paulo default
  ) {}

  async isSlotAvailable(input: {
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    now: Date;
    ignoreHoldId?: string;
  }): Promise<boolean> {
    const [appointmentsCount, holdsCount, withinRule] = await Promise.all([
      this.prisma.appointment.count({
        where: {
          professionalId: input.professionalId,
          status: { notIn: ["CANCELLED", "RESCHEDULED"] },
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
        },
      }),
      this.prisma.slotHold.count({
        where: {
          professionalId: input.professionalId,
          status: "HELD",
          expiresAt: { gt: input.now },
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
          ...(input.ignoreHoldId ? { id: { not: input.ignoreHoldId } } : {}),
        },
      }),
      this.isWithinAvailabilityRules(input.professionalId, input.startsAt, input.endsAt),
    ]);

    return appointmentsCount === 0 && holdsCount === 0 && withinRule;
  }

  /**
   * Checks that the slot falls entirely within at least one availability rule
   * for the professional on the given weekday.
   */
  private async isWithinAvailabilityRules(
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean> {
    // Convert to local time for weekday and time comparison
    const localStart = new Date(startsAt.getTime() + this.timezoneOffsetMinutes * 60_000);
    const localEnd = new Date(endsAt.getTime() + this.timezoneOffsetMinutes * 60_000);

    // JS getUTCDay: 0=Sunday, 1=Monday, ...
    const weekday = localStart.getUTCDay();

    const rules = await this.prisma.professionalAvailabilityRule.findMany({
      where: { professionalId, weekday },
    });

    if (rules.length === 0) return false;

    const slotStartMinutes = localStart.getUTCHours() * 60 + localStart.getUTCMinutes();
    const slotEndMinutes = localEnd.getUTCHours() * 60 + localEnd.getUTCMinutes();

    return rules.some((rule) => {
      const [rStartH, rStartM] = rule.startTime.split(":").map(Number);
      const [rEndH, rEndM] = rule.endTime.split(":").map(Number);
      const ruleStartMin = rStartH * 60 + rStartM;
      const ruleEndMin = rEndH * 60 + rEndM;
      return slotStartMinutes >= ruleStartMin && slotEndMinutes <= ruleEndMin;
    });
  }
}
