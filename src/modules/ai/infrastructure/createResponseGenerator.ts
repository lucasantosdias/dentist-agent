import type { ResponseGeneratorPort } from "@/modules/ai/application/ports/ResponseGeneratorPort";
import { OllamaResponseGenerator } from "./OllamaResponseGenerator";

type CreateResponseGeneratorConfig = {
  provider: "ollama" | "openai" | "mock";
  ollamaBaseUrl?: string;
  ollamaModel?: string;
};

/**
 * Factory for response generator.
 *
 * Returns null when provider is "mock" — the orchestrator will
 * fall back to deterministic templates.
 */
export function createResponseGenerator(
  config: CreateResponseGeneratorConfig,
): ResponseGeneratorPort | null {
  switch (config.provider) {
    case "ollama":
      return new OllamaResponseGenerator({
        baseUrl: config.ollamaBaseUrl ?? "http://host.docker.internal:11434",
        model: config.ollamaModel ?? "qwen2.5:7b-instruct",
      });

    // Future: OpenAI implementation
    case "openai":
      return null;

    case "mock":
      return null;

    default:
      return null;
  }
}
