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
  if (
    n.includes("reagend") || n.includes("remarcar") ||
    n.includes("mudar meu horario") || n.includes("mudar minha consulta") ||
    n.includes("trocar minha consulta") || n.includes("trocar meu horario") ||
    n.includes("alterar meu horario") || n.includes("alterar minha consulta")
  ) return "RESCHEDULE_APPOINTMENT";
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
  if (byName) return byName.service_code;

  // Numeric selection: "1", "2" etc. — maps to catalog index when in booking flow
  const trimmed = input.user_text.trim();
  if (/^\d+$/.test(trimmed) && input.current_intent === "BOOK_APPOINTMENT") {
    const index = Number(trimmed) - 1;
    if (index >= 0 && index < input.catalog.services.length) {
      return input.catalog.services[index].service_code;
    }
  }
  return null;
}

function inferProfessionalName(input: LlmInterpretationInput): string | null {
  const text = normalize(input.user_text);
  const prof = input.catalog.professionals.find((p) => text.includes(normalize(p.name)));
  return prof?.name ?? null;
}

function inferName(input: LlmInterpretationInput): string | null {
  // Explicit name patterns
  const match = input.user_text.match(/(?:meu nome [eé]|me chamo|sou o|sou a)\s+(.+)/i);
  if (match?.[1]) {
    return match[1].trim().split(" ").slice(0, 5).join(" ").trim();
  }

  // Context-aware: if the conversation is collecting name (transactional intent
  // and full_name is not yet collected), treat a short capitalized message as
  // a name response.
  const nameCollectingIntents = new Set([
    "BOOK_APPOINTMENT", "RESCHEDULE_APPOINTMENT", "CANCEL_APPOINTMENT", "CONFIRM_APPOINTMENT",
  ]);
  if (
    nameCollectingIntents.has(input.current_intent ?? "") &&
    !input.known_data.patient_name &&
    !(input.collected_data as Record<string, unknown> | undefined)?.full_name
  ) {
    const text = input.user_text.trim();
    // Check: 1-5 words, starts with uppercase, no booking/service keywords
    const looksLikeName = /^[A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){0,4}$/.test(text);
    if (looksLikeName && text.length >= 3 && text.length <= 60) {
      return text;
    }
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

  // Handle "meio dia" / "meio-dia" → 12:00
  const isMeioDia = /\bmeio[- ]?dia\b/.test(n);
  const isMeiaNoite = /\bmeia[- ]?noite\b/.test(n);

  const hourMatch = n.match(/\b(\d{1,2})h(\d{2})\b/)  // "9h30", "14h00"
    || n.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:h|hrs?)\b/)  // "9h", "14:30h"
    || n.match(/\b(?:as|a)\s*(\d{1,2})(?::(\d{2}))?\b/)  // "as 15", "as 9:30"
    || n.match(/\bpara\s*(?:as\s*)?(\d{1,2})(?::(\d{2}))?\b/);  // "para as 15", "para 9:30"
  if (!hourMatch && !isMeioDia && !isMeiaNoite) return null;

  const hour = isMeioDia ? 12 : isMeiaNoite ? 0 : Number(hourMatch![1]);
  const minute = (isMeioDia || isMeiaNoite) ? 0 : Number(hourMatch![2] ?? "0");
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

/**
 * Extract CPF from text. Matches formats: 123.456.789-00 or 12345678900
 */
function inferCpf(text: string): string | null {
  const formatted = text.match(/\b(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2})\b/);
  if (formatted) {
    return formatted[1].replace(/\D/g, "");
  }
  // 11 consecutive digits
  const raw = text.match(/\b(\d{11})\b/);
  return raw ? raw[1] : null;
}

/**
 * Extract birth date from text. Matches: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
 */
function inferBirthDate(text: string): string | null {
  const match = text.match(/\b(\d{2})[/\-.](\d{2})[/\-.](\d{4})\b/);
  if (!match) return null;
  const [, day, month, year] = match;
  const y = Number(year);
  if (y < 1920 || y > 2020) return null;
  return `${year}-${month}-${day}`;
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
  // Acceptance
  if (n.includes("confirmo") || n.includes("pode ser") || n.includes("esse horario")) return true;
  // Rejection / change request
  if (
    n.includes("nao quero") || n.includes("nao posso") || n.includes("nao consigo") ||
    n.includes("outro horario") || n.includes("outra hora") ||
    n.includes("prefiro") || n.includes("melhor") ||
    n.includes("acho que") || n.includes("na verdade") ||
    n.includes("pensando bem") || n.includes("mudar") || n.includes("trocar")
  ) return false;
  return null;
}

export class MockLlmInterpreter implements LlmInterpreterPort {
  async interpret(input: LlmInterpretationInput): Promise<LlmInterpretation> {
    const intent = inferIntent(input.user_text, input);

    const entities: LlmInterpretation["entities"] = {
      full_name: inferName(input),
      cpf: inferCpf(input.user_text),
      birth_date: inferBirthDate(input.user_text),
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
