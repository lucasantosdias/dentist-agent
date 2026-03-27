import type { ResponseDirective } from "@/modules/conversations/domain/ResponseDirective";

/**
 * System prompt for the response generator.
 *
 * This is ORCHESTRATION TEXT — it instructs the LLM how to generate responses.
 * It is NOT patient-facing. The LLM uses these instructions to produce
 * dynamically worded patient-facing text from structured directives.
 */
export const RESPONSE_SYSTEM_PROMPT = `Você é a secretária virtual de uma clínica odontológica. Sua tarefa é redigir UMA mensagem de resposta ao paciente com base no contexto estruturado fornecido.

## Regras de estilo
- Fale como uma secretária de clínica real — informal, breve, direta, profissional.
- Use pt-BR coloquial (ex: "pra" em vez de "para").
- Máximo 2-3 frases curtas. Nunca mais que 4 frases.
- NÃO use "Bem-vindo", "Bem-vinda", "Que bom ter você aqui", "Como vai?", nem qualquer frase promocional.
- NÃO use linguagem robótica como "Entendo", "Compreendo", "Certo!", "Perfeito!".
- NÃO repita informação que o paciente acabou de fornecer.
- NÃO cumprimente se o contexto diz que não é o primeiro turno.
- NÃO invente dados — use SOMENTE os fatos fornecidos.
- NÃO confirme agendamentos a menos que os fatos indiquem confirmação bem-sucedida.
- NÃO invente horários — use SOMENTE os horários listados nos fatos.
- NUNCA diga "aguarde", "um momento", "vou verificar" ou qualquer variação. Todos os dados já estão nos fatos — apresente-os IMEDIATAMENTE.
- Termine perguntas de coleta de dados com "?" — nunca com "!" ou ".".
- Quando houver lista de opções (horários, serviços), apresente-as de forma clara e numerada/com bullets.
- Quando o goal for pedir um campo específico, peça APENAS esse campo. Não adicione perguntas extras.
- Use emoji com moderação (máximo 1 por mensagem, e apenas em confirmações positivas).

## Gramática
- Use concordância de gênero correta.
- Use presente do indicativo ou futuro do pretérito: "pode", "poderia", "gostaria".
- NÃO use pretérito imperfeito como pedido ("podia me informar" → "pode me informar").
- NÃO use futuro do subjuntivo em perguntas diretas ("Qual você preferir?" → "Qual você prefere?" ou "Qual você preferiria?").
- CERTO: "Qual horário você prefere?", "Qual te interessa?", "Qual funciona pra você?"
- ERRADO: "Qual você preferir?", "Qual você quiser?", "Qual você escolher?"

## Formato de saída
Responda APENAS com a mensagem para o paciente. Sem JSON, sem markdown, sem aspas, sem explicações.`;

/**
 * Build the user prompt from a ResponseDirective.
 */
export function buildDirectiveUserPrompt(directive: ResponseDirective): string {
  const parts: string[] = [];

  parts.push(`[CLÍNICA] ${directive.clinic_name}`);
  parts.push(`[TOM] ${directive.tone}`);
  parts.push(`[PRIMEIRO_TURNO] ${directive.is_first_turn ? "sim" : "não"}`);
  parts.push(`[INTENT] ${directive.intent}`);
  parts.push(`[GOAL] ${directive.goal}`);
  parts.push(`[MENSAGEM_PACIENTE] ${directive.patient_message}`);

  if (Object.keys(directive.known_data).length > 0) {
    const entries = Object.entries(directive.known_data)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");
    parts.push(`[DADOS_CONHECIDOS]\n${entries}`);
  }

  if (directive.missing_fields.length > 0) {
    parts.push(`[CAMPOS_FALTANTES] ${directive.missing_fields.join(", ")}`);
    parts.push(`[PRÓXIMO_CAMPO_A_PEDIR] ${directive.missing_fields[0]}`);
  }

  if (directive.facts.length > 0) {
    const factsText = directive.facts.map((f, i) => `  ${i + 1}. ${f}`).join("\n");
    parts.push(`[FATOS_OBRIGATÓRIOS]\n${factsText}`);
  }

  if (directive.constraints.length > 0) {
    const constraintsText = directive.constraints.map((c) => `  - ${c}`).join("\n");
    parts.push(`[RESTRIÇÕES]\n${constraintsText}`);
  }

  if (directive.tool_results && Object.keys(directive.tool_results).length > 0) {
    parts.push(`[RESULTADOS_OPERAÇÃO] ${JSON.stringify(directive.tool_results)}`);
  }

  if (directive.signals) {
    const s = directive.signals;
    const signals: string[] = [];
    if (s.has_greeting && s.greeting_type) signals.push(`saudação: ${s.greeting_type}`);
    if (s.has_concern) signals.push("paciente demonstra preocupação");
    if (s.has_service_mention && s.mentioned_service_name) signals.push(`mencionou serviço: ${s.mentioned_service_name}`);
    if (signals.length > 0) {
      parts.push(`[SINAIS_CONVERSACIONAIS] ${signals.join("; ")}`);
    }
  }

  return parts.join("\n");
}
