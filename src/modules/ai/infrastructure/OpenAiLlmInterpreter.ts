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

type OpenAiMessage = {
  role: "system" | "user";
  content: string;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function extractJsonBlock(text: string): string {
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

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export class OpenAiLlmInterpreter implements LlmInterpreterPort {
  constructor(
    private readonly config: {
      apiKey: string;
      model: string;
      baseUrl?: string;
      timeoutMs?: number;
    },
  ) {}

  async interpret(input: LlmInterpretationInput): Promise<LlmInterpretation> {
    if (!this.config.apiKey) {
      console.warn("[LLM] OpenAI failed after retries, falling back to heuristic classifier");
    return mockFallback.interpret(input);
    }

    const timeoutMs = this.config.timeoutMs ?? 30_000;
    const endpoint = joinUrl(this.config.baseUrl ?? "https://api.openai.com/v1", "/chat/completions");

    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const messages: OpenAiMessage[] = [
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
        ];

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          continue;
        }

        const data = (await response.json()) as OpenAiChatCompletionResponse;
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          continue;
        }

        const parsed = llmOutputSchema.safeParse(JSON.parse(extractJsonBlock(content)));
        if (parsed.success) {
          return parsed.data;
        }

        console.warn("OpenAI response failed Zod validation:", parsed.error.flatten());
      } catch {
        // retry
      } finally {
        clearTimeout(timer);
      }
    }

    console.warn("[LLM] OpenAI failed after retries, falling back to heuristic classifier");
    return mockFallback.interpret(input);
  }
}
