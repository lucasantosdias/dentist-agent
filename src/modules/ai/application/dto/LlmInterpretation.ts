// ─── Re-export from single source of truth ─────────────────
// Intent and stage definitions live in @/shared/domain/constants.
// This file re-exports them for backward compatibility.

import type {
  LlmIntent,
  LlmStage,
  UrgencyLevel,
  CareType,
} from "@/shared/domain/constants";

export {
  LLM_INTENTS as llmIntents,
  LLM_STAGES as llmStages,
  URGENCY_LEVELS as urgencyLevels,
  CARE_TYPES as careTypes,
} from "@/shared/domain/constants";

export type { LlmIntent, LlmStage, CareType };
export type LlmUrgency = UrgencyLevel;

export type LlmEntities = {
  full_name?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
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
