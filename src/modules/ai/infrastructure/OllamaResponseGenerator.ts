import type {
  ResponseGeneratorPort,
  ResponseGenerationInput,
} from "@/modules/ai/application/ports/ResponseGeneratorPort";

const RESPONSE_SYSTEM_PROMPT = `Você é a secretária de uma clínica odontológica brasileira. Fale exatamente como uma secretária de consultório real falaria — simpática, acolhedora, profissional e natural. Não diga seu nome nem cargo, apenas atenda naturalmente.

PERSONALIDADE:
- Você é uma pessoa real, não um robô. Fale como se estivesse atendendo no balcão.
- Use português brasileiro natural e correto gramaticalmente.
- Use "pra" em vez de "para" quando soar natural.
- Seja breve e direta. Secretárias não fazem discursos.
- Se o paciente está preocupado ou com medo, tranquilize com carinho genuíno.
- Se a conversa já começou (continuação), NÃO cumprimente de novo. Vá direto ao assunto.

SAUDAÇÃO (apenas na primeira mensagem):
- Se o paciente cumprimenta, retribua brevemente e vá direto pra ajuda.
- NÃO empilhe saudação + pergunta pessoal + pergunta de ajuda na mesma frase.
- NÃO adicione "tudo bem?", "como vai?", "tá?" a menos que o paciente tenha perguntado primeiro.
- NÃO repita a mesma estrutura de saudação do paciente — adapte naturalmente.
- Máximo: uma saudação curta + uma pergunta de como ajudar. Nada mais.
- CERTO: "Boa tarde! Como posso te ajudar?"
- CERTO: "Oi! Em que posso ajudar?"
- ERRADO: "Boa tarde! Tudo bem? Como posso te ajudar hoje?"
- ERRADO: "Oi! Tudo bem aqui, e com você? Como posso ajudar?"

ESTILO OBRIGATÓRIO:
- Curto, educado, direto, prestativo.
- NÃO use frases promocionais ou de marketing.
- NÃO use "Bem-vindo", "Bem-vinda", "Que bom ter você aqui", "É um prazer", "Ficamos felizes".
- NÃO use "tá?" como confirmação no final de frases.

REGRAS OBRIGATÓRIAS:
- Incorpore TODOS os fatos fornecidos na resposta. Não omita nenhum.
- NÃO invente informações além dos fatos.
- NÃO confirme agendamentos ou horários por conta própria.
- Máximo 2 a 3 frases curtas.
- Responda APENAS com o texto, sem JSON, sem markdown, sem aspas.

GRAMÁTICA:
- Respeite concordância de gênero: "sua mensagem" (não "seu mensagem"), "sua consulta", "seu agendamento".
- Respeite concordância verbal e nominal do português brasileiro padrão.
- Não misture formalidade: se está usando "você", não use "senhor" na mesma frase.
- Use tempos verbais corretos:
  - CERTO: "Pode me informar", "Poderia me informar", "Consegue me dizer"
  - ERRADO: "Podia me informar" (pretérito imperfeito usado como pedido — incorreto neste contexto)
  - CERTO: "Qual é o seu nome?", "Como posso te ajudar?"
  - ERRADO: "Qual era o seu nome?", "Como podia te ajudar?"
- Na dúvida, use presente do indicativo ou futuro do pretérito (condicional): "pode", "poderia", "gostaria".`;

function buildGenerationUserPrompt(input: ResponseGenerationInput): string {
  const parts: string[] = [];

  parts.push(`Estilo: ${input.tone}`);
  parts.push(`Clínica: ${input.clinicName}`);
  parts.push(`Mensagem do paciente: "${input.userMessage}"`);

  if (input.isFirstTurn === false) {
    parts.push("CONTEXTO: Esta é uma continuação da conversa. NÃO cumprimente novamente. Vá direto ao ponto.");
  }

  if (input.signals) {
    const signalParts: string[] = [];
    if (input.signals.hasGreeting && input.signals.greetingType && input.isFirstTurn !== false) {
      signalParts.push(`Paciente cumprimentou com: "${input.signals.greetingType}"`);
    }
    if (input.signals.hasConcern) {
      signalParts.push("Paciente demonstrou preocupação ou insegurança");
    }
    if (input.signals.hasServiceMention && input.signals.mentionedServiceName) {
      signalParts.push(`Paciente mencionou o serviço: ${input.signals.mentionedServiceName}`);
    }
    if (signalParts.length > 0) {
      parts.push(`Sinais conversacionais: ${signalParts.join("; ")}`);
    }
  }

  parts.push("FATOS OBRIGATÓRIOS (inclua todos na resposta):");
  input.facts.forEach((f, i) => parts.push(`  ${i + 1}. ${f}`));

  if (input.constraints && input.constraints.length > 0) {
    parts.push("RESTRIÇÕES (NÃO faça isto):");
    input.constraints.forEach((c) => parts.push(`  - ${c}`));
  }

  parts.push("Gere a resposta:");

  return parts.join("\n");
}

type OllamaChatResponse = {
  message?: { content: string };
  done: boolean;
};

export class OllamaResponseGenerator implements ResponseGeneratorPort {
  constructor(
    private readonly config: {
      baseUrl: string;
      model: string;
      timeoutMs?: number;
    },
  ) {}

  async generate(input: ResponseGenerationInput): Promise<string> {
    const timeoutMs = this.config.timeoutMs ?? 15_000;
    const endpoint = `${this.config.baseUrl.replace(/\/$/, "")}/api/chat`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          stream: false,
          options: { temperature: 0.7 },
          messages: [
            { role: "system", content: RESPONSE_SYSTEM_PROMPT },
            { role: "user", content: buildGenerationUserPrompt(input) },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`[ResponseGenerator] Ollama returned ${response.status}`);
        return this.fallback(input);
      }

      const data = (await response.json()) as OllamaChatResponse;
      const content = data.message?.content?.trim();

      if (!content) {
        console.warn("[ResponseGenerator] Ollama returned empty content");
        return this.fallback(input);
      }

      return content;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("[ResponseGenerator] Ollama request timed out");
      } else {
        console.warn("[ResponseGenerator] Ollama request failed:", error);
      }
      return this.fallback(input);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Deterministic fallback when LLM is unavailable */
  private fallback(input: ResponseGenerationInput): string {
    return input.facts.join(" ");
  }
}
