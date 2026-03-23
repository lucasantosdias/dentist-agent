import type { LlmIntent } from "@/modules/ai/application/dto/LlmInterpretation";
import type { ClinicSettings } from "@/modules/clinic/domain/ClinicSettings";
import { resolveTemplate, buildServiceListText } from "./ResponseComposer";

/**
 * Fallback question map used when clinic_settings is not available.
 * Contains ALL field questions for backward compatibility.
 */
const FALLBACK_QUESTION_MAP: Record<string, string> = {
  full_name: "Pra eu dar andamento, pode me informar seu nome completo?",
  care_type: "Vai ser particular ou por convênio?",
  service_code: "Qual procedimento você gostaria de agendar?",
  datetime_iso: "E qual seria o melhor dia e horário pra você?",
  professional_name: "Tem preferência por algum dos nossos profissionais?",
  insurance_name: "Qual o nome do seu convênio?",
  primary_reason: "Pode me contar o motivo da consulta?",
  preferred_date: "Qual dia ficaria melhor pra você?",
  preferred_time: "E o horário, tem alguma preferência?",
  appointment_id: "Qual agendamento você gostaria de alterar?",
  symptom: "Pode me descrever o que você está sentindo?",
  urgency_level: "Entendi. Numa escala de urgência, como você classifica?",
};

/**
 * Map field names to template keys from clinic_settings.
 */
const FIELD_TO_TEMPLATE_KEY: Record<string, string> = {
  full_name: "ask_name",
  care_type: "ask_care_type",
  service_code: "ask_service",
  datetime_iso: "ask_datetime",
  professional_name: "ask_professional",
};

export type QuestionBuilderContext = {
  settings?: ClinicSettings | null;
  catalogServices?: Array<{ name: string }>;
  catalogProfessionals?: Array<{ name: string }>;
};

export function buildNextQuestion(
  missingFields: string[],
  intent: LlmIntent,
  llmSuggestion?: string | null,
  context?: QuestionBuilderContext,
): string {
  if (missingFields.length === 0) {
    return llmSuggestion ?? "Posso confirmar o agendamento?";
  }

  const priorityOrder = getFieldPriority(intent, missingFields);
  const nextField = priorityOrder.find((f) => missingFields.includes(f)) ?? missingFields[0];

  // Special: service_code with catalog list
  if (nextField === "service_code" && context?.catalogServices && context.catalogServices.length > 0) {
    const list = context.catalogServices.map((s, i) => `  ${i + 1}) ${s.name}`).join("\n");
    return `Certo! Temos os seguintes procedimentos disponíveis:\n\n${list}\n\nQual deles te interessa?`;
  }

  // professional_name is auto-resolved via availability lookup — no question needed.
  // The system presents time slots and assigns the professional internally.

  // Try clinic_settings template
  const templateKey = FIELD_TO_TEMPLATE_KEY[nextField];
  if (templateKey && context?.settings) {
    const vars: Record<string, string> = {};
    if (nextField === "service_code" && context.catalogServices) {
      vars.services = buildServiceListText(context.catalogServices);
    }
    return resolveTemplate(
      context.settings,
      templateKey as import("@/shared/domain/constants").TemplateKey,
      vars,
    );
  }

  // Fallback to static map
  return FALLBACK_QUESTION_MAP[nextField] ?? llmSuggestion ?? `Preciso saber: ${nextField}. Pode informar?`;
}

/**
 * Determine field collection priority for a given intent.
 *
 * For BOOK_APPOINTMENT, the order depends on what's already known:
 * - If service is NOT yet known → ask service first (show the list)
 * - If service IS known → ask name first, then care_type, then professional, then datetime
 *
 * This avoids asking "what's your name?" before the patient even chose what they want.
 */
function getFieldPriority(intent: LlmIntent, missingFields: string[]): string[] {
  switch (intent) {
    case "BOOK_APPOINTMENT": {
      const serviceStillMissing = missingFields.includes("service_code");
      if (serviceStillMissing) {
        return ["service_code", "primary_reason", "full_name", "care_type", "datetime_iso"];
      }
      // professional_name is not in the priority — system auto-assigns from availability
      return ["full_name", "care_type", "datetime_iso"];
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
  intent: LlmIntent,
  missingFields: string[],
  hasHold: boolean,
): string {
  if (missingFields.length === 0 && hasHold) return "AWAITING_CONFIRMATION";
  if (missingFields.length === 0) return "AWAITING_SLOT_SELECTION";
  if (missingFields.length > 0) return "COLLECTING_DATA";
  return "IDLE";
}
