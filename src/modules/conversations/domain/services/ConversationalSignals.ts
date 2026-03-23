import { GREETING_TOKENS, CONCERN_PATTERNS } from "@/shared/domain/constants";

/**
 * Lightweight conversational signal detection.
 *
 * Extracts secondary signals from a user message WITHOUT changing
 * the primary intent classification. These signals are used by the
 * response composition layer to add natural acknowledgments.
 *
 * Example: "boa tarde, quero marcar uma limpeza"
 *   → primary intent: BOOK_APPOINTMENT (unchanged)
 *   → signals: { hasGreeting: true, greetingReply: "Boa tarde!" }
 *
 * This is pure text analysis — no LLM, no state, no side effects.
 */

export type ConversationalSignals = {
  hasGreeting: boolean;
  greetingReply: string | null;
  hasServiceMention: boolean;
  mentionedServiceName: string | null;
  hasConcern: boolean;
};

type CatalogService = { service_code: string; name: string };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Detect conversational signals embedded in a user message.
 */
export function detectConversationalSignals(
  text: string,
  services: CatalogService[],
): ConversationalSignals {
  const n = normalize(text);
  const original = text.toLowerCase();

  // Detect greeting
  let hasGreeting = false;
  let greetingReply: string | null = null;
  for (const token of GREETING_TOKENS) {
    if (token.pattern.test(original) || token.pattern.test(n)) {
      hasGreeting = true;
      greetingReply = token.reply;
      break;
    }
  }

  // Detect service mention
  let hasServiceMention = false;
  let mentionedServiceName: string | null = null;
  for (const svc of services) {
    if (n.includes(normalize(svc.name)) || n.includes(normalize(svc.service_code))) {
      hasServiceMention = true;
      mentionedServiceName = svc.name;
      break;
    }
  }

  // Detect concern/confusion
  const hasConcern = CONCERN_PATTERNS.some(
    (p) => p.test(original) || p.test(n),
  );

  return { hasGreeting, greetingReply, hasServiceMention, mentionedServiceName, hasConcern };
}

/**
 * Intents where the handler's response already includes the service name,
 * so the prefix should NOT repeat it.
 */
const INTENTS_WITH_SERVICE_IN_BODY = new Set(["SERVICE_INFO", "LIST_SERVICES"]);

/**
 * Intents that are urgency-sensitive and should receive an empathetic
 * prefix instead of a generic request-acknowledgment.
 */
const URGENCY_INTENTS = new Set(["PAIN_OR_URGENT_CASE"]);

/**
 * Intents where acknowledgment should be suppressed entirely because
 * the response must be operationally exact and concise.
 */
const SUPPRESS_PREFIX_INTENTS = new Set(["TALK_TO_HUMAN"]);

/**
 * Build an acknowledgment prefix from detected signals.
 *
 * Rules:
 * - Only applied on the first conversational turn (attempts <= 1)
 * - Only when the primary intent is NOT already GREETING
 * - Suppressed for intents that require exact operational responses
 * - For urgency intents: empathetic prefix instead of request-ack
 * - For SERVICE_INFO: skip service mention (handler already says it)
 * - For booking intents with service mention: "Greeting! Posso te ajudar com o agendamento da X."
 * - Greeting without service: just the greeting echo
 * - No greeting: returns null (no prefix)
 *
 * Returns null when no prefix should be added.
 */
export function buildAcknowledgmentPrefix(
  signals: ConversationalSignals,
  primaryIntent: string,
  conversationAttempts: number,
): string | null {
  // Don't add prefix if the primary intent is already a greeting
  if (primaryIntent === "GREETING") return null;

  // Only on the first turn of a conversation
  if (conversationAttempts > 1) return null;

  // Suppress on operational intents
  if (SUPPRESS_PREFIX_INTENTS.has(primaryIntent)) return null;

  // No greeting detected — no prefix
  if (!signals.hasGreeting || !signals.greetingReply) return null;

  const greeting = signals.greetingReply;

  // Urgency intents: empathetic, human-sounding
  if (URGENCY_INTENTS.has(primaryIntent)) {
    return `${greeting} Vou te ajudar com isso agora, fique tranquilo(a).`;
  }

  // SERVICE_INFO / LIST_SERVICES: handler body already covers the content
  if (INTENTS_WITH_SERVICE_IN_BODY.has(primaryIntent)) {
    return greeting;
  }

  // Concern/confusion: reassuring
  if (signals.hasConcern) {
    if (signals.hasServiceMention && signals.mentionedServiceName) {
      return `${greeting} Fique tranquilo(a), vou te ajudar com isso.`;
    }
    return `${greeting} Fique tranquilo(a), estou aqui pra te ajudar.`;
  }

  // Booking-like intents with a service mention
  if (signals.hasServiceMention && signals.mentionedServiceName) {
    return `${greeting} Claro, vou te ajudar com o agendamento.`;
  }

  // Greeting only
  return greeting;
}
