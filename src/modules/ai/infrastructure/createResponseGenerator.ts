import type { ResponseGeneratorPort } from "@/modules/ai/application/ports/ResponseGeneratorPort";
import { OllamaResponseGenerator } from "./OllamaResponseGenerator";
import { OpenAiResponseGenerator } from "./OpenAiResponseGenerator";

type CreateResponseGeneratorConfig = {
  provider: "ollama" | "openai" | "mock";
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
};

export function createResponseGenerator(
  config: CreateResponseGeneratorConfig,
): ResponseGeneratorPort | null {
  switch (config.provider) {
    case "ollama":
      return new OllamaResponseGenerator({
        baseUrl: config.ollamaBaseUrl ?? "http://host.docker.internal:11434",
        model: config.ollamaModel ?? "qwen3:30b-a3b",
      });

    case "openai":
      return new OpenAiResponseGenerator({
        apiKey: config.openAiApiKey ?? "",
        model: config.openAiModel ?? "gpt-4o-mini",
        baseUrl: config.openAiBaseUrl,
      });

    case "mock":
      return null;

    default:
      return null;
  }
}
