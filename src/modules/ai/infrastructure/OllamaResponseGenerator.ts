import type { ResponseGeneratorPort } from "@/modules/ai/application/ports/ResponseGeneratorPort";
import type { ResponseDirective } from "@/modules/conversations/domain/ResponseDirective";
import { RESPONSE_SYSTEM_PROMPT, buildDirectiveUserPrompt } from "./responseGeneratorPrompt";

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

  async generate(directive: ResponseDirective): Promise<string> {
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
            { role: "user", content: buildDirectiveUserPrompt(directive) },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`[ResponseGenerator] Ollama returned ${response.status}`);
        return this.fallback(directive);
      }

      const data = (await response.json()) as OllamaChatResponse;
      const raw = data.message?.content?.trim() ?? "";
      const content = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      if (!content) {
        console.warn("[ResponseGenerator] Ollama returned empty content");
        return this.fallback(directive);
      }

      return content;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("[ResponseGenerator] Ollama request timed out");
      } else {
        console.warn("[ResponseGenerator] Ollama request failed:", error);
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
