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
  reply_text: string;
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

export type CatalogSnapshot = {
  services: Array<{ service_code: string; name: string; duration_min: number }>;
  professionals: Array<{ name: string }>;
};

export interface CatalogSnapshotPort {
  execute(clinicId: string): Promise<CatalogSnapshot>;
}
