import { z } from "zod";

export const llmOutputSchema = z
  .object({
    intent: z.enum([
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
    ]),
    stage: z.enum([
      "NEEDS_INFO",
      "COLLECTING_REQUIRED_FIELDS",
      "USER_SELECTED_SLOT",
      "USER_CONFIRMED_DETAILS",
      "INFORMATIONAL_RESPONSE",
    ]),
    user_accepts_slot: z.boolean().nullable().optional(),
    entities: z.object({
      full_name: z.string().min(1).nullable().optional(),
      phone_number: z.string().min(1).nullable().optional(),
      care_type: z.enum(["PARTICULAR", "INSURANCE"]).nullable().optional(),
      insurance_name: z.string().min(1).nullable().optional(),
      service_code: z.string().min(1).nullable().optional(),
      primary_reason: z.string().min(1).nullable().optional(),
      symptom: z.string().min(1).nullable().optional(),
      professional_name: z.string().min(1).nullable().optional(),
      preferred_date: z.string().min(1).nullable().optional(),
      preferred_time: z.string().min(1).nullable().optional(),
      datetime_iso: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)?$/)
        .nullable()
        .optional(),
      appointment_id: z.string().min(1).nullable().optional(),
      urgency_level: z.enum(["BAIXA", "MEDIA", "ALTA"]).nullable().optional(),
    }).default({}),
    missing: z.array(z.string()).default([]),
    suggested_next_question: z.string().nullable().optional(),
  });

export type LlmOutputDto = z.infer<typeof llmOutputSchema>;
