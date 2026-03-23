import type { AvailabilityRule } from "./AvailabilityRule";
import type { TimeSlot } from "@/modules/scheduling/application/dto/SchedulingDtos";

/**
 * Generates candidate time slots for a given date based on availability rules.
 * Does NOT check for conflicts — that is done by the availability engine.
 */
export function generateCandidateSlots(
  rules: AvailabilityRule[],
  targetDate: Date,
  serviceDurationMinutes: number,
  timezoneOffsetMinutes: number,
): TimeSlot[] {
  const localDate = new Date(targetDate.getTime() + timezoneOffsetMinutes * 60_000);
  const weekday = localDate.getUTCDay();

  const dayRules = rules.filter((r) => r.weekday === weekday);
  if (dayRules.length === 0) return [];

  // Midnight UTC of the local date, shifted back to UTC
  const dayStartUtc = new Date(
    Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate()),
  );
  const baseMs = dayStartUtc.getTime() - timezoneOffsetMinutes * 60_000;

  const slots: TimeSlot[] = [];

  for (const rule of dayRules) {
    const ruleSlots = rule.generateSlots(serviceDurationMinutes);

    for (const s of ruleSlots) {
      const startsAt = new Date(baseMs + s.startMinutes * 60_000);
      const endsAt = new Date(baseMs + s.endMinutes * 60_000);
      slots.push({ startsAt, endsAt });
    }
  }

  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return slots;
}
