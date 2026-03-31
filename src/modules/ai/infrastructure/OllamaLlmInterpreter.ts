import type {
  LlmInterpretation,
  LlmInterpretationInput,
} from "@/modules/ai/application/dto/LlmInterpretation";
import type { LlmInterpreterPort } from "@/modules/ai/application/ports/LlmInterpreterPort";
import { llmOutputSchema } from "@/modules/ai/infrastructure/llmOutputSchema";
import { buildClassificationSystemPrompt } from "@/modules/ai/infrastructure/prompts/classificationPrompt";
import { buildUserPrompt } from "@/modules/ai/infrastructure/prompts/systemPrompt";
import { MockLlmInterpreter } from "@/modules/ai/infrastructure/MockLlmInterpreter";

const mockFallback = new MockLlmInterpreter();

type OllamaChatResponse = {
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
};

export class OllamaLlmInterpreter implements LlmInterpreterPort {
  constructor(
    private readonly config: {
      baseUrl: string;
      model: string;
      timeoutMs?: number;
    },
  ) {}

  async interpret(input: LlmInterpretationInput): Promise<LlmInterpretation> {
    const timeoutMs = this.config.timeoutMs ?? 30_000;
    const endpoint = `${this.config.baseUrl.replace(/\/$/, "")}/api/chat`;

    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.config.model,
            stream: false,
            format: "json",
            options: { temperature: 0 },
            messages: [
              { role: "system", content: buildClassificationSystemPrompt() },
              {
                role: "user",
                content: buildUserPrompt({
                  userText: input.user_text,
                  nowIso: input.now_iso,
                  timezone: input.timezone,
                  patientState: input.patient_state,
                  conversationState: input.conversation_state,
                  currentIntent: input.current_intent,
                  collectedData: input.collected_data,
                  knownData: input.known_data,
                  catalog: input.catalog,
                  recentMessages: input.recent_messages,
                  isRetry: attempt > 0,
                }),
              },
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          console.error(`[LLM] Ollama returned ${response.status}: ${await response.text()}`);
          continue;
        }

        const data = (await response.json()) as OllamaChatResponse;
        const rawContent = data.message?.content;

        if (!rawContent) {
          console.warn("[LLM] Ollama returned empty content");
          continue;
        }

        // Strip qwen3 <think> blocks before parsing JSON
        const content = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

        console.log("[LLM] Ollama raw response:", content.slice(0, 500));

        try {
          const jsonText = this.extractJsonBlock(content);
          const raw = JSON.parse(jsonText);
          const parsed = llmOutputSchema.safeParse(raw);

          if (parsed.success) {
            console.log("[LLM] Ollama classified intent:", parsed.data.intent);
            return this.normalizeInterpretation(parsed.data);
          }

          console.warn("[LLM] Ollama JSON failed Zod validation:", parsed.error.flatten());
        } catch (parseErr) {
          console.warn("[LLM] Failed to parse Ollama response as JSON:", parseErr);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.warn(`[LLM] Ollama request timed out (attempt ${attempt + 1})`);
        } else {
          console.error(`[LLM] Ollama request failed (attempt ${attempt + 1}):`, error);
        }
      } finally {
        clearTimeout(timer);
      }
    }

    console.warn("[LLM] Ollama failed after retries, falling back to heuristic classifier");
    return mockFallback.interpret(input);
  }

  private normalizeInterpretation(raw: LlmInterpretation): LlmInterpretation {
    return {
      intent: raw.intent,
      stage: raw.stage,
      user_accepts_slot: raw.user_accepts_slot ?? null,
      entities: {
        full_name: raw.entities.full_name ?? null,
        phone_number: raw.entities.phone_number ?? null,
        care_type: raw.entities.care_type ?? null,
        insurance_name: raw.entities.insurance_name ?? null,
        service_code: raw.entities.service_code ?? null,
        primary_reason: raw.entities.primary_reason ?? null,
        symptom: raw.entities.symptom ?? null,
        professional_name: raw.entities.professional_name ?? null,
        preferred_date: raw.entities.preferred_date ?? null,
        preferred_time: raw.entities.preferred_time ?? null,
        datetime_iso: raw.entities.datetime_iso ?? null,
        appointment_id: raw.entities.appointment_id ?? null,
        urgency_level: raw.entities.urgency_level ?? null,
      },
      missing: raw.missing ?? [],
      suggested_next_question: raw.suggested_next_question ?? null,
    };
  }

  private extractJsonBlock(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed;
    }
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
      return trimmed;
    }
    return trimmed.slice(first, last + 1);
  }
}
