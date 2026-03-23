export const llmIntents = [
  "GREETING",
  "LIST_SERVICES",
  "SERVICE_INFO",
  "CLINIC_INFO",
  "INSURANCE_INFO",
  "HOURS_INFO",
  "LOCATION_INFO",
  "BOOK_APPOINTMENT",
  "RESCHEDULE_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "CONFIRM_APPOINTMENT",
  "CHECK_AVAILABILITY",
  "PAIN_OR_URGENT_CASE",
  "SMALL_TALK",
  "TALK_TO_HUMAN",
  "UNKNOWN",
] as const;

export const llmStages = [
  "NEEDS_INFO",
  "COLLECTING_REQUIRED_FIELDS",
  "USER_SELECTED_SLOT",
  "USER_CONFIRMED_DETAILS",
  "INFORMATIONAL_RESPONSE",
] as const;

export const urgencyLevels = ["BAIXA", "MEDIA", "ALTA"] as const;
export const careTypes = ["PARTICULAR", "INSURANCE"] as const;

export type LlmIntent = (typeof llmIntents)[number];
export type LlmStage = (typeof llmStages)[number];
export type LlmUrgency = (typeof urgencyLevels)[number];
export type CareType = (typeof careTypes)[number];

export type LlmEntities = {
  full_name?: string | null;
  phone_number?: string | null;
  care_type?: CareType | null;
  insurance_name?: string | null;
  service_code?: string | null;
  primary_reason?: string | null;
  symptom?: string | null;
  professional_name?: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  datetime_iso?: string | null;
  appointment_id?: string | null;
  urgency_level?: LlmUrgency | null;
};

export type LlmInterpretation = {
  intent: LlmIntent;
  stage: LlmStage;
  user_accepts_slot?: boolean | null;
  entities: LlmEntities;
  missing: string[];
  suggested_next_question?: string | null;
};

export type LlmContextMessage = {
  direction: "INBOUND" | "OUTBOUND";
  text: string;
  created_at: string;
};

export type LlmInterpretationInput = {
  user_text: string;
  now_iso: string;
  timezone: string;
  patient_state: string;
  conversation_state: string;
  current_intent?: string | null;
  collected_data?: Record<string, unknown>;
  known_data: {
    patient_name?: string | null;
  };
  catalog: {
    services: Array<{ service_code: string; name: string; duration_min: number }>;
    professionals: Array<{ name: string }>;
  };
  recent_messages: LlmContextMessage[];
};
