/**
 * Centralized domain constants and enums.
 *
 * These are system-level definitions — NOT clinic-editable content.
 * Template text, greetings, and other clinic-configurable strings
 * belong in clinic_settings (database), not here.
 */

// ─── Intent Classification ───────────────────────────────

export const LLM_INTENTS = [
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

export type LlmIntent = (typeof LLM_INTENTS)[number];

export const TRANSACTIONAL_INTENTS: ReadonlySet<LlmIntent> = new Set([
  "BOOK_APPOINTMENT",
  "RESCHEDULE_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "CONFIRM_APPOINTMENT",
  "CHECK_AVAILABILITY",
  "PAIN_OR_URGENT_CASE",
]);

export const INFORMATIONAL_INTENTS: ReadonlySet<LlmIntent> = new Set([
  "GREETING",
  "LIST_SERVICES",
  "SERVICE_INFO",
  "CLINIC_INFO",
  "INSURANCE_INFO",
  "HOURS_INFO",
  "LOCATION_INFO",
]);

// ─── Service Info Detection ──────────────────────────────

/**
 * Interrogative patterns in pt-BR that indicate the user is asking
 * ABOUT a service/procedure, not trying to book it.
 */
export const SERVICE_INTERROGATIVE_PATTERNS = [
  /\bcomo funciona\b/,
  /\bo que [eé]\b/,
  /\bpra que serve\b/,
  /\bpara que serve\b/,
  /\bcomo [eé] (?:feito|feita|o|a)\b/,
  /\b(?:doi|dói)\b/,
  /\bdolorido\b/,
  /\bdoloroso\b/,
  /\bprecisa de preparo\b/,
  /\bprecisa preparar\b/,
  /\bquanto tempo (?:dura|leva|demora)\b/,
  /\bcomo [eé] o procedimento\b/,
  /\besse procedimento\b/,
  /\bo que acontece\b/,
  /\bcomo [eé] a\b/,
  /\btratamento de\b/,
  /\bme (?:explica|fala|conte)\b.*(?:sobre|do|da|de)\b/,
  /\bquero saber (?:sobre|mais|do|da|de)\b/,
  /\binformac(?:ao|oes) sobre\b/,
] as const;

// ─── Opening / Presence-Check Patterns ───────────────────

/**
 * Patterns that indicate the user is checking if someone is there
 * or initiating contact. These should be treated as greetings on a
 * fresh conversation, NOT as human-handoff requests.
 */
export const OPENING_PATTERNS = [
  /\balgu[eé]m\b.*\b(?:a[ií]|aqui|online)\b/,  // "alguem por ai?", "alguém aí?"
  /\btem\b.*\balgu[eé]m\b/,                       // "tem alguém aí?"
  /\bconsegue\b.*\b(?:ajudar|atender|me)\b/,     // "consegue me ajudar?"
  /\btem como\b.*\b(?:atender|ajudar|me)\b/,     // "tem como me atender?"
  /\bvoc[eê]s\b.*\batende[m]?\b/,                // "vocês atendem?"
  /\bestou\b.*\bprecisando\b/,                    // "estou precisando"
  /\balgu[eé]m\b.*\bpode\b/,                      // "alguém pode me ajudar?"
  /\btem\b.*\b(?:atendimento|algu[eé]m)\b/,      // "tem atendimento?", "tem alguém?"
] as const;

/**
 * Patterns that indicate vague help-seeking — not specific enough
 * to be a booking request. These should route to SMALL_TALK (guided
 * help) rather than BOOK_APPOINTMENT.
 */
export const HELP_SEEKING_PATTERNS = [
  /^(?:preciso|quero)\s+(?:de\s+)?ajuda\b/,      // "preciso de ajuda", "quero ajuda"
  /^(?:preciso|quero)\s+(?:de\s+)?atendimento\b/, // "preciso de atendimento"
  /\bcomo\b.*\bfunciona[m]?\b(?!\s+(?:a|o|uma?)\s)/,  // "como vocês funcionam?" (not "como funciona a limpeza")
  /\bcomo\b.*\bfaz(?:em)?\b.*\bpara\b/,          // "como faço para ser atendido?"
] as const;

/**
 * Explicit human-handoff keywords. Only these should trigger TALK_TO_HUMAN.
 * "atendente" alone in a fresh conversation is NOT sufficient — the user
 * may be asking "vocês atendem?" which is an opening, not a handoff.
 */
export const EXPLICIT_HUMAN_HANDOFF_PATTERNS = [
  /\b(?:falar|conversar)\b.*\b(?:humano|atendente|pessoa|recep[çc][ãa]o)\b/,
  /\b(?:transfer[ie]|passa|encaminha)\b.*\b(?:atendente|humano|pessoa)\b/,
  /\bn[ãa]o quero\b.*\b(?:rob[oô]|bot|m[áa]quina|automatico)\b/,
  /\bquero\b.*\b(?:humano|atendente|pessoa real)\b/,
  /\bme\b.*\b(?:transfere|passa|encaminha)\b/,
] as const;

// ─── Greeting Type Detection ─────────────────────────────

/**
 * Greeting tokens in pt-BR. Used for conversational signal detection —
 * recognizing greetings embedded inside mixed-intent messages.
 * These are NOT anchored to the start of the message (unlike the classifier).
 */
export const GREETING_TOKENS: ReadonlyArray<{ pattern: RegExp; reply: string }> = [
  { pattern: /\bboa noite\b/, reply: "Boa noite!" },
  { pattern: /\bboa tarde\b/, reply: "Boa tarde!" },
  { pattern: /\bbom dia\b/, reply: "Bom dia!" },
  { pattern: /\bol[aá]\b/, reply: "Olá!" },
  { pattern: /\boi\b/, reply: "Oi!" },
];

// ─── Concern / Confusion Patterns ────────────────────────

/**
 * Patterns indicating the user is expressing concern, confusion, or
 * discomfort. These warrant an empathetic acknowledgment even when
 * the intent is informational or booking-related.
 */
export const CONCERN_PATTERNS = [
  /\bn[aã]o sei o que fazer\b/,
  /\bn[aã]o sei\b.*\bcomeçar\b/,
  /\bestou\b.*\bpreocupad[oa]\b/,
  /\btô\b.*\bpreocupad[oa]\b/,
  /\bestou\b.*\bcom medo\b/,
  /\btô\b.*\bcom medo\b/,
  /\bsujo[s]?\b/,
  /\bmuito\b.*\b(?:feio|ruim|mal)\b/,
  /\bnunca\b.*\bfui\b/,
  /\bfaz tempo\b/,
  /\bvergonha\b/,
  /\bmedo\b.*\bdentista\b/,
] as const;

// ─── Conversation Stages ─────────────────────────────────

export const LLM_STAGES = [
  "NEEDS_INFO",
  "COLLECTING_REQUIRED_FIELDS",
  "USER_SELECTED_SLOT",
  "USER_CONFIRMED_DETAILS",
  "INFORMATIONAL_RESPONSE",
] as const;

export type LlmStage = (typeof LLM_STAGES)[number];

// ─── Conversation State ──────────────────────────────────

export const CONVERSATION_STATES = ["AUTO", "WAITING", "HUMAN", "FINALIZADA"] as const;

export type ConversationState = (typeof CONVERSATION_STATES)[number];

// ─── Patient Lifecycle ───────────────────────────────────

export const PATIENT_STATES = [
  "LEAD_NEW",
  "LEAD_QUALIFIED",
  "LEAD_INACTIVE",
  "ACTIVE",
  "INACTIVE",
] as const;

export type PatientState = (typeof PATIENT_STATES)[number];

// ─── Care Type ───────────────────────────────────────────

export const CARE_TYPES = ["PARTICULAR", "INSURANCE"] as const;

export type CareType = (typeof CARE_TYPES)[number];

// ─── Urgency ─────────────────────────────────────────────

export const URGENCY_LEVELS = ["BAIXA", "MEDIA", "ALTA"] as const;

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

// ─── Knowledge Document Types ────────────────────────────

export const KNOWLEDGE_DOCUMENT_TYPES = [
  "PROCEDURE",
  "PREPARATION",
  "FAQ",
  "RETURN_CYCLE",
  "INSURANCE_DETAIL",
  "POLICY",
] as const;

export type KnowledgeDocumentType = (typeof KNOWLEDGE_DOCUMENT_TYPES)[number];

// ─── Tone (clinic_settings.tone) ─────────────────────────

export const TONE_OPTIONS = [
  "formal",
  "warm_professional",
  "casual",
  "clinical",
] as const;

export type ToneOption = (typeof TONE_OPTIONS)[number];

// ─── Response Strategy ───────────────────────────────────

export const RESPONSE_STRATEGIES = [
  "deterministic",
  "hybrid",
  "rag_hybrid",
] as const;

export type ResponseStrategy = (typeof RESPONSE_STRATEGIES)[number];

// ─── Template Keys ───────────────────────────────────────

export const TEMPLATE_KEYS = [
  "ask_name",
  "ask_care_type",
  "ask_service",
  "ask_datetime",
  "ask_professional",
  "hold_created",
  "appointment_confirmed",
  "no_slots",
  "escalate_human",
  "greeting",
  "fallback",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

// ─── Funnel Steps ────────────────────────────────────────

export const FUNNEL_STEPS = [
  "IDLE",
  "COLLECTING_DATA",
  "AWAITING_SLOT_SELECTION",
  "AWAITING_CONFIRMATION",
  "COMPLETED",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];
