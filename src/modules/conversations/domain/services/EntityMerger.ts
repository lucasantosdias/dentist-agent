import type { LlmEntities } from "@/modules/ai/application/dto/LlmInterpretation";
import type { CollectedData } from "./RequirementResolver";

export function mergeEntitiesIntoCollectedData(
  existing: CollectedData,
  newEntities: LlmEntities,
): CollectedData {
  const merged = { ...existing };

  const fields: Array<keyof LlmEntities> = [
    "full_name",
    "cpf",
    "birth_date",
    "phone_number",
    "care_type",
    "insurance_name",
    "service_code",
    "primary_reason",
    "symptom",
    "professional_name",
    "preferred_date",
    "preferred_time",
    "datetime_iso",
    "appointment_id",
    "urgency_level",
  ];

  for (const field of fields) {
    const newValue = newEntities[field];
    if (newValue !== undefined && newValue !== null && newValue !== "") {
      merged[field] = newValue;
    }
  }

  return merged;
}
