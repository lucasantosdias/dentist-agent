import type { LlmIntent } from "@/modules/ai/application/dto/LlmInterpretation";

/**
 * Field priority and funnel step logic.
 *
 * This module determines WHICH field to collect next and what funnel step
 * the conversation is in. It does NOT generate patient-facing text —
 * that is the LLM's responsibility.
 */

/**
 * Determine field collection priority for a given intent.
 *
 * For BOOK_APPOINTMENT, the order depends on what's already known:
 * - If service is NOT yet known → ask service first (show the list)
 * - If service IS known → ask name first, then care_type, then professional, then datetime
 */
export function getFieldPriority(intent: LlmIntent, missingFields: string[]): string[] {
  switch (intent) {
    case "BOOK_APPOINTMENT": {
      const serviceStillMissing = missingFields.includes("service_code");
      if (serviceStillMissing) {
        return ["service_code", "primary_reason", "full_name", "cpf", "care_type", "datetime_iso"];
      }
      return ["full_name", "cpf", "care_type", "datetime_iso"];
    }
    case "RESCHEDULE_APPOINTMENT":
      return ["full_name", "appointment_id", "datetime_iso"];
    case "CANCEL_APPOINTMENT":
      return ["full_name", "appointment_id"];
    case "CONFIRM_APPOINTMENT":
      return ["full_name", "appointment_id"];
    case "PAIN_OR_URGENT_CASE":
      return ["full_name", "symptom"];
    default:
      return ["full_name"];
  }
}

export function buildFunnelStep(
  _intent: LlmIntent,
  missingFields: string[],
  hasHold: boolean,
): string {
  if (missingFields.length === 0 && hasHold) return "AWAITING_CONFIRMATION";
  if (missingFields.length === 0) return "AWAITING_SLOT_SELECTION";
  if (missingFields.length > 0) return "COLLECTING_DATA";
  return "IDLE";
}
