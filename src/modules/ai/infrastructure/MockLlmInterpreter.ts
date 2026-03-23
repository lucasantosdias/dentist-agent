import type {
  LlmInterpretation,
  LlmInterpretationInput,
} from "@/modules/ai/application/dto/LlmInterpretation";
import type { LlmInterpreterPort } from "@/modules/ai/application/ports/LlmInterpreterPort";
import {
  SERVICE_INTERROGATIVE_PATTERNS,
  OPENING_PATTERNS,
  HELP_SEEKING_PATTERNS,
  EXPLICIT_HUMAN_HANDOFF_PATTERNS,
} from "@/shared/domain/constants";

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const WEEKDAY_MAP: Record<string, Weekday> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesAny(text: string, patterns: ReadonlyArray<RegExp>): boolean {
  const n = normalize(text);
  const original = text.toLowerCase();
  return patterns.some((p) => p.test(original) || p.test(n));
}

/**
 * Detect if the message is an interrogative question about a specific service.
 */
function isServiceInfoQuery(text: string, input: LlmInterpretationInput): boolean {
  if (!matchesAny(text, SERVICE_INTERROGATIVE_PATTERNS)) return false;

  const n = normalize(text);
  const referencesService = input.catalog.services.some((s) => {
    return n.includes(normalize(s.service_code)) || n.includes(normalize(s.name));
  });

  const hasGenericProcedureTerm =
    n.includes("procedimento") || n.includes("tratamento") || n.includes("servico");

  return referencesService || hasGenericProcedureTerm;
}

function inferIntent(text: string, input: LlmInterpretationInput): LlmInterpretation["intent"] {
  const n = normalize(text);

  // ── Layer 1: Explicit human handoff (highest priority) ──
  // Only explicit "quero falar com humano/atendente" patterns, NOT "vocês atendem?"
  if (matchesAny(text, EXPLICIT_HUMAN_HANDOFF_PATTERNS)) return "TALK_TO_HUMAN";

  // ── Layer 2: Cancellation / reschedule / confirmation ──
  if (n.includes("cancel")) return "CANCEL_APPOINTMENT";
  if (n.includes("reagend") || n.includes("remarcar")) return "RESCHEDULE_APPOINTMENT";
  if (n.includes("confirmar presenca") || n.includes("confirmar presença")) return "CONFIRM_APPOINTMENT";

  // ── Layer 3: Service info (before booking/pain so "canal dói?" doesn't become PAIN) ──
  if (isServiceInfoQuery(text, input)) return "SERVICE_INFO";

  // ── Layer 4: Service listing ──
  if (
    n.includes("servico") || n.includes("servicos") ||
    n.includes("procedimento") || n.includes("procedimentos")
  ) {
    if (n.includes("quais") || n.includes("lista") || n.includes("oferecem") || n.includes("tem")) {
      return "LIST_SERVICES";
    }
  }

  // ── Layer 5: Clinic info ──
  if (n.includes("convenio") || n.includes("plano")) return "INSURANCE_INFO";
  if (n.includes("horario") && (n.includes("funciona") || n.includes("atend"))) return "HOURS_INFO";
  if (n.includes("onde fica") || n.includes("endereco") || n.includes("localizacao")) return "LOCATION_INFO";

  // ── Layer 6: Opening / presence-check (before PAIN and BOOKING) ──
  // "alguem por ai?", "tem alguém aí?", "consegue me ajudar?" → GREETING
  if (matchesAny(text, OPENING_PATTERNS)) return "GREETING";

  // ── Layer 7: Vague help-seeking (before BOOKING so "preciso de ajuda" isn't BOOK) ──
  if (matchesAny(text, HELP_SEEKING_PATTERNS)) return "SMALL_TALK";

  // ── Layer 8: Pain / urgency ──
  if (
    n.includes("dor") || n.includes("urgente") || n.includes("urgencia") ||
    n.includes("quebrou") || n.includes("sangr") || n.includes("inchad") ||
    n.includes("emergencia")
  ) return "PAIN_OR_URGENT_CASE";

  // ── Layer 9: Booking (specific keywords) ──
  if (
    n.includes("agendar") || n.includes("marcar") || n.includes("consulta") ||
    n.includes("quero") || n.includes("preciso") ||
    n.includes("gostaria") || n.includes("queria")
  ) {
    return "BOOK_APPOINTMENT";
  }

  // ── Layer 10: Availability ──
  if (n.includes("disponib")) return "CHECK_AVAILABILITY";

  // ── Layer 11: Simple greeting (beginning of message) ──
  const isGreeting = /^(oi|ola|bom dia|boa tarde|boa noite|hey|hello|hi)\b/.test(n);
  if (isGreeting) return "GREETING";

  return "UNKNOWN";
}

function inferServiceCode(input: LlmInterpretationInput): string | null {
  const text = normalize(input.user_text);
  const byCode = input.catalog.services.find((s) => text.includes(normalize(s.service_code)));
  if (byCode) return byCode.service_code;
  const byName = input.catalog.services.find((s) => text.includes(normalize(s.name)));
  return byName?.service_code ?? null;
}

function inferProfessionalName(input: LlmInterpretationInput): string | null {
  const text = normalize(input.user_text);
  const prof = input.catalog.professionals.find((p) => text.includes(normalize(p.name)));
  return prof?.name ?? null;
}

function inferName(input: LlmInterpretationInput): string | null {
  const match = input.user_text.match(/(?:meu nome [eé]|me chamo|sou o|sou a)\s+(.+)/i);
  if (match?.[1]) {
    return match[1].trim().split(" ").slice(0, 5).join(" ").trim();
  }
  return input.known_data.patient_name ?? null;
}

function nextWeekday(base: Date, target: Weekday): Date {
  const result = new Date(base);
  const current = result.getDay();
  let delta = (target - current + 7) % 7;
  if (delta === 0) delta = 7;
  result.setDate(result.getDate() + delta);
  return result;
}

function formatIsoMinus03(date: Date): string {
  const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const min = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00-03:00`;
}

function inferDatetimeIso(input: LlmInterpretationInput): string | null {
  const raw = input.user_text.trim();
  const n = normalize(raw);

  const isoDirect = raw.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)/);
  if (isoDirect) return isoDirect[0];

  const hourMatch = n.match(/\b(\d{1,2})(?::(\d{2}))?\s*h\b/) || n.match(/\b(?:as|a)\s*(\d{1,2})(?::(\d{2}))\b/);
  if (!hourMatch) return null;

  const hour = Number(hourMatch[1]);
  const minute = Number(hourMatch[2] ?? "0");
  if (hour > 23 || minute > 59) return null;

  const now = new Date(input.now_iso);
  if (Number.isNaN(now.getTime())) return null;

  let base = new Date(now);

  if (n.includes("amanha") || n.includes("amanhã")) {
    base.setDate(base.getDate() + 1);
  }

  for (const [label, weekday] of Object.entries(WEEKDAY_MAP)) {
    if (n.includes(label)) {
      base = nextWeekday(now, weekday);
      break;
    }
  }

  base.setHours(hour, minute, 0, 0);
  return formatIsoMinus03(base);
}

function inferCareType(text: string): "PARTICULAR" | "INSURANCE" | null {
  const n = normalize(text);
  if (n.includes("particular")) return "PARTICULAR";
  if (n.includes("convenio") || n.includes("plano")) return "INSURANCE";
  return null;
}

function inferStage(
  intent: LlmInterpretation["intent"],
  text: string,
  hasSlotData: boolean,
): LlmInterpretation["stage"] {
  const n = normalize(text);

  const informationalIntents = new Set([
    "GREETING", "SMALL_TALK", "LIST_SERVICES", "SERVICE_INFO", "CLINIC_INFO", "INSURANCE_INFO",
    "HOURS_INFO", "LOCATION_INFO",
  ]);
  if (informationalIntents.has(intent)) return "INFORMATIONAL_RESPONSE";

  const transactionalIntents = new Set([
    "BOOK_APPOINTMENT", "RESCHEDULE_APPOINTMENT",
  ]);
  if (transactionalIntents.has(intent)) {
    if (n.includes("confirmo") || n.includes("pode confirmar") || n.includes("pode agendar")) {
      return "USER_CONFIRMED_DETAILS";
    }
    if (hasSlotData) return "USER_SELECTED_SLOT";
    return "NEEDS_INFO";
  }

  return "NEEDS_INFO";
}

function detectUserAcceptsSlot(text: string): boolean | null {
  const n = normalize(text);
  if (n.includes("confirmo") || n.includes("pode ser") || n.includes("esse horario")) return true;
  if (n.includes("nao quero") || n.includes("outro horario")) return false;
  return null;
}

export class MockLlmInterpreter implements LlmInterpreterPort {
  async interpret(input: LlmInterpretationInput): Promise<LlmInterpretation> {
    const intent = inferIntent(input.user_text, input);

    const entities: LlmInterpretation["entities"] = {
      full_name: inferName(input),
      service_code: inferServiceCode(input),
      professional_name: inferProfessionalName(input),
      datetime_iso: inferDatetimeIso(input),
      care_type: inferCareType(input.user_text),
      urgency_level: normalize(input.user_text).includes("dor") ? "ALTA" : null,
      primary_reason: null,
      symptom: normalize(input.user_text).includes("dor") ? "dor de dente" : null,
    };

    const hasSlotData = Boolean(entities.professional_name && entities.service_code && entities.datetime_iso);
    const stage = inferStage(intent, input.user_text, hasSlotData);

    return {
      intent,
      stage,
      user_accepts_slot: detectUserAcceptsSlot(input.user_text),
      entities,
      missing: [],
      suggested_next_question: null,
    };
  }
}
