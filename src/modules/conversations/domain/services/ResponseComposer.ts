import type { ClinicSettings } from "@/modules/clinic/domain/ClinicSettings";
import type { ResponseGeneratorPort } from "@/modules/ai/application/ports/ResponseGeneratorPort";
import type { ConversationalSignals } from "./ConversationalSignals";
import type { TemplateKey } from "@/shared/domain/constants";

/**
 * Response composition with optional LLM generation.
 *
 * Strategy:
 * 1. If a ResponseGeneratorPort is available → use LLM to generate natural response from facts
 * 2. If not → fall back to deterministic template interpolation
 *
 * The backend ALWAYS decides the facts. The LLM only decides the wording.
 */

/**
 * Compose a response using LLM generation or template fallback.
 *
 * @param opts
 */
export async function composeResponse(opts: {
  generator: ResponseGeneratorPort | null;
  settings: ClinicSettings | null;
  templateKey: TemplateKey;
  facts: string[];
  userMessage: string;
  isFirstTurn?: boolean;
  signals?: ConversationalSignals;
  vars?: Record<string, string>;
  constraints?: string[];
}): Promise<string> {
  // Try LLM generation first
  if (opts.generator && opts.settings) {
    try {
      const result = await opts.generator.generate({
        facts: opts.facts,
        constraints: opts.constraints,
        tone: opts.settings.tone,
        botName: opts.settings.botName,
        clinicName: opts.settings.clinicDisplayName,
        userMessage: opts.userMessage,
        isFirstTurn: opts.isFirstTurn,
        signals: opts.signals
          ? {
              hasGreeting: opts.signals.hasGreeting,
              greetingType: opts.signals.greetingReply,
              hasConcern: opts.signals.hasConcern,
              hasServiceMention: opts.signals.hasServiceMention,
              mentionedServiceName: opts.signals.mentionedServiceName,
            }
          : undefined,
      });
      return result;
    } catch (err) {
      console.warn("[ResponseComposer] LLM generation failed, using fallback:", err);
    }
  }

  // Deterministic fallback: use facts directly when available (they already
  // contain the backend-built question/response text), then template, then join.
  if (opts.facts.length > 0) {
    return opts.facts.join(" ");
  }

  if (opts.settings) {
    return resolveTemplate(opts.settings, opts.templateKey, opts.vars);
  }

  return "Como posso te ajudar?";
}

/**
 * Resolve a template from clinic settings with variable interpolation.
 * This is the deterministic fallback — no LLM involved.
 */
export function resolveTemplate(
  settings: ClinicSettings,
  key: TemplateKey,
  vars?: Record<string, string>,
): string {
  let text = settings.getTemplate(key);

  // Always inject clinic_name
  text = text.replaceAll("{clinic_name}", settings.clinicDisplayName);

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }

  return text;
}

/**
 * Build the service list string from catalog data.
 */
export function buildServiceListText(
  services: Array<{ name: string }>,
): string {
  if (services.length === 0) return "";
  return services.map((s) => s.name).join(", ");
}
