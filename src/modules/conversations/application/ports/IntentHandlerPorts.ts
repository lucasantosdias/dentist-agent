import type { LlmInterpretation } from "@/modules/ai/application/dto/LlmInterpretation";

export type SchedulingIntentInput = {
  clinic_id: string;
  patient_id: string;
  conversation_id: string;
  patient_known_name: string | null;
  interpretation: LlmInterpretation;
  now: Date;
};

export type SchedulingIntentResult = {
  goal: string;
  facts: string[];
  constraints: string[];
  missing_fields: string[];
  conversation_state: "AUTO" | "WAITING";
  appointment?: {
    id: string;
    status: string;
    starts_at: string;
    ends_at: string;
    professional_name: string;
    service_code: string;
  };
  patient_name_captured?: string;
};

export interface SchedulingIntentHandlerPort {
  execute(input: SchedulingIntentInput): Promise<SchedulingIntentResult>;
}

export type CancellationInput = {
  patient_id: string;
  all_patient_ids?: string[];
  requested_datetime_iso?: string | null;
  reason?: string | null;
  now: Date;
};

export type CancellationResult =
  | { kind: "NO_APPOINTMENTS" }
  | {
      kind: "NEEDS_CLARIFICATION";
      options: Array<{ appointment_id: string; starts_at_iso: string; service_code: string; professional_name: string }>;
    }
  | {
      kind: "CANCELLED";
      appointment: {
        id: string;
        status: string;
        starts_at_iso: string;
        ends_at_iso: string;
        service_code: string;
        professional_name: string;
      };
    };

export interface CancellationHandlerPort {
  execute(input: CancellationInput): Promise<CancellationResult>;
}

export type ConfirmPresenceInput = {
  patient_id: string;
  all_patient_ids?: string[];
  requested_datetime_iso?: string | null;
  now: Date;
};

export type ConfirmPresenceResult =
  | { kind: "NO_APPOINTMENTS" }
  | {
      kind: "NEEDS_CLARIFICATION";
      options: Array<{ appointment_id: string; starts_at_iso: string; service_code: string; professional_name: string }>;
    }
  | {
      kind: "CONFIRMED";
      appointment: {
        id: string;
        status: string;
        starts_at_iso: string;
        ends_at_iso: string;
        service_code: string;
        professional_name: string;
      };
    };

export interface ConfirmPresenceHandlerPort {
  execute(input: ConfirmPresenceInput): Promise<ConfirmPresenceResult>;
}

export type RescheduleInput = {
  patient_id: string;
  all_patient_ids?: string[];
  clinic_id: string;
  patient_name?: string | null;
  patient_cpf?: string | null;
  requested_datetime_iso?: string | null;
  new_datetime_iso?: string | null;
  now: Date;
};

export type RescheduleResult =
  | { kind: "NO_APPOINTMENTS" }
  | {
      kind: "NEEDS_CLARIFICATION";
      options: Array<{ appointment_id: string; starts_at_iso: string; service_code: string; professional_name: string }>;
    }
  | { kind: "NEEDS_NEW_DATETIME"; current_appointment: { id: string; starts_at_iso: string; service_code: string; professional_name: string } }
  | { kind: "SLOT_UNAVAILABLE"; current_appointment: { id: string; starts_at_iso: string; service_code: string; professional_name: string }; available_times?: string[] }
  | {
      kind: "RESCHEDULED";
      old_appointment: { id: string; starts_at_iso: string; service_code: string; professional_name: string };
      new_appointment: { id: string; status: string; starts_at_iso: string; ends_at_iso: string; service_code: string; professional_name: string };
    };

export interface RescheduleHandlerPort {
  execute(input: RescheduleInput): Promise<RescheduleResult>;
}

export type CatalogSnapshot = {
  services: Array<{ service_code: string; name: string; duration_min: number }>;
  professionals: Array<{ name: string }>;
};

export interface CatalogSnapshotPort {
  execute(clinicId: string): Promise<CatalogSnapshot>;
}
