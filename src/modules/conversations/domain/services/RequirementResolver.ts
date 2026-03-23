import type { LlmIntent } from "@/modules/ai/application/dto/LlmInterpretation";

type RequirementDefinition = {
  required: string[];
  optional: string[];
};

const REQUIREMENTS_BY_INTENT: Partial<Record<LlmIntent, RequirementDefinition>> = {
  BOOK_APPOINTMENT: {
    required: ["full_name", "care_type", "datetime_iso"],
    optional: ["professional_name", "insurance_name", "urgency_level"],
  },
  RESCHEDULE_APPOINTMENT: {
    required: ["full_name", "appointment_id", "datetime_iso"],
    optional: [],
  },
  CANCEL_APPOINTMENT: {
    required: ["full_name", "appointment_id"],
    optional: [],
  },
  CONFIRM_APPOINTMENT: {
    required: ["full_name"],
    optional: ["appointment_id"],
  },
  CHECK_AVAILABILITY: {
    required: [],
    optional: ["preferred_date", "datetime_iso"],
  },
  PAIN_OR_URGENT_CASE: {
    required: ["full_name"],
    optional: ["symptom", "urgency_level"],
  },
};

export type CollectedData = Record<string, string | boolean | null | undefined>;

export function getRequiredFields(intent: LlmIntent): string[] {
  return REQUIREMENTS_BY_INTENT[intent]?.required ?? [];
}

export function getOptionalFields(intent: LlmIntent): string[] {
  return REQUIREMENTS_BY_INTENT[intent]?.optional ?? [];
}

export function resolveMissingRequirements(
  intent: LlmIntent,
  collectedData: CollectedData,
): string[] {
  const required = getRequiredFields(intent);
  return required.filter((field) => {
    const value = collectedData[field];
    return value === undefined || value === null || value === "";
  });
}

export function hasServiceOrReason(collectedData: CollectedData): boolean {
  return Boolean(collectedData.service_code || collectedData.primary_reason);
}

export function resolveMissingForBooking(collectedData: CollectedData): string[] {
  const missing: string[] = [];

  if (!collectedData.full_name) missing.push("full_name");
  if (!collectedData.care_type) missing.push("care_type");
  if (!hasServiceOrReason(collectedData)) missing.push("service_code");
  // professional_name is NOT required — the system auto-selects based on availability.
  // The patient only chooses a time slot; the professional is revealed at confirmation.
  if (!collectedData.datetime_iso) missing.push("datetime_iso");

  return missing;
}

export function isIntentTransactional(intent: LlmIntent): boolean {
  const transactional: LlmIntent[] = [
    "BOOK_APPOINTMENT",
    "RESCHEDULE_APPOINTMENT",
    "CANCEL_APPOINTMENT",
    "CONFIRM_APPOINTMENT",
    "CHECK_AVAILABILITY",
    "PAIN_OR_URGENT_CASE",
  ];
  return transactional.includes(intent);
}

export function isIntentInformational(intent: LlmIntent): boolean {
  const informational: LlmIntent[] = [
    "GREETING",
    "LIST_SERVICES",
    "SERVICE_INFO",
    "CLINIC_INFO",
    "INSURANCE_INFO",
    "HOURS_INFO",
    "LOCATION_INFO",
  ];
  return informational.includes(intent);
}
