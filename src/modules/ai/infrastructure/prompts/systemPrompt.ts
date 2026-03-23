/**
 * Prompt builders for LLM interpreters.
 *
 * System prompt is now delegated to classificationPrompt.ts (single source of truth).
 * This file keeps the buildUserPrompt function which injects dynamic context.
 */

import { buildClassificationSystemPrompt } from "./classificationPrompt";

/**
 * @deprecated Use buildClassificationSystemPrompt() from classificationPrompt.ts directly.
 * Kept for backward compatibility during migration.
 */
export function buildSystemPrompt(): string {
  return buildClassificationSystemPrompt();
}

/**
 * @deprecated Use buildClassificationSystemPrompt() from classificationPrompt.ts directly.
 */
export function buildSystemPromptForTools(): string {
  return buildClassificationSystemPrompt();
}

export function buildUserPrompt(context: {
  userText: string;
  nowIso: string;
  timezone: string;
  patientState: string;
  conversationState: string;
  currentIntent?: string | null;
  collectedData?: Record<string, unknown>;
  knownData: Record<string, unknown>;
  catalog: {
    services: Array<{ service_code: string; name: string; duration_min: number }>;
    professionals: Array<{ name: string }>;
  };
  recentMessages: Array<{ direction: string; text: string; created_at: string }>;
  isRetry?: boolean;
}): string {
  const parts: string[] = [];

  if (context.isRetry) {
    parts.push("ATENÇÃO: A resposta anterior foi inválida. Retorne JSON estrito seguindo exatamente o schema.");
  }

  parts.push(`Mensagem do paciente: "${context.userText}"`);
  parts.push(`Data/hora atual: ${context.nowIso}`);
  parts.push(`Timezone: ${context.timezone}`);
  parts.push(`Estado do paciente: ${context.patientState}`);
  parts.push(`Estado da conversa: ${context.conversationState}`);

  if (context.currentIntent) {
    parts.push(`Intent atual da conversa: ${context.currentIntent}`);
  }

  if (context.collectedData && Object.keys(context.collectedData).length > 0) {
    parts.push(`Dados já coletados: ${JSON.stringify(context.collectedData)}`);
  }

  if (Object.keys(context.knownData).length > 0) {
    parts.push(`Dados conhecidos do paciente: ${JSON.stringify(context.knownData)}`);
  }

  parts.push(`Serviços disponíveis: ${JSON.stringify(context.catalog.services)}`);
  parts.push(`Profissionais disponíveis: ${JSON.stringify(context.catalog.professionals)}`);

  if (context.recentMessages.length > 0) {
    parts.push(`Mensagens recentes da conversa:\n${JSON.stringify(context.recentMessages)}`);
  }

  parts.push("Classifique esta mensagem retornando o JSON conforme o schema.");

  return parts.join("\n\n");
}
