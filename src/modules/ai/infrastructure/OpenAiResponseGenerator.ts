import type { ResponseGeneratorPort } from "@/modules/ai/application/ports/ResponseGeneratorPort";
import type { ResponseDirective } from "@/modules/conversations/domain/ResponseDirective";
import { RESPONSE_SYSTEM_PROMPT, buildDirectiveUserPrompt } from "./responseGeneratorPrompt";

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export class OpenAiResponseGenerator implements ResponseGeneratorPort {
  constructor(
    private readonly config: {
      apiKey: string;
      model: string;
      baseUrl?: string;
      timeoutMs?: number;
    },
  ) {}

  async generate(directive: ResponseDirective): Promise<string> {
    const timeoutMs = this.config.timeoutMs ?? 30_000;
    const baseUrl = (this.config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const endpoint = `${baseUrl}/chat/completions`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.7,
          messages: [
            { role: "system", content: RESPONSE_SYSTEM_PROMPT },
            { role: "user", content: buildDirectiveUserPrompt(directive) },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`[ResponseGenerator] OpenAI returned ${response.status}`);
        return this.fallback(directive);
      }

      const data = (await response.json()) as OpenAiChatResponse;
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        console.warn("[ResponseGenerator] OpenAI returned empty content");
        return this.fallback(directive);
      }

      return content;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("[ResponseGenerator] OpenAI request timed out");
      } else {
        console.warn("[ResponseGenerator] OpenAI request failed:", error);
      }
      return this.fallback(directive);
    } finally {
      clearTimeout(timer);
    }
  }

  private fallback(directive: ResponseDirective): string {
    return directive.facts.join(" ");
  }
}
