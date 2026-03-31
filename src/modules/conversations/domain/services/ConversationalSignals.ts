import { GREETING_TOKENS, CONCERN_PATTERNS } from "@/shared/domain/constants";

/**
 * Lightweight conversational signal detection.
 *
 * Extracts secondary signals from a user message WITHOUT changing
 * the primary intent classification. These signals are passed to the
 * LLM response generator so it can naturally acknowledge greetings,
 * concerns, and service mentions.
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
