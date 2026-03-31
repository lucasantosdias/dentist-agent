import type { LlmInterpreterPort } from "@/modules/ai/application/ports/LlmInterpreterPort";
import { MockLlmInterpreter } from "@/modules/ai/infrastructure/MockLlmInterpreter";
import { OllamaLlmInterpreter } from "@/modules/ai/infrastructure/OllamaLlmInterpreter";
import { OpenAiLlmInterpreter } from "@/modules/ai/infrastructure/OpenAiLlmInterpreter";

type CreateLlmInterpreterConfig = {
  provider: "ollama" | "openai" | "mock";
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
};

export function createLlmInterpreter(config: CreateLlmInterpreterConfig): LlmInterpreterPort {
  switch (config.provider) {
    case "ollama":
      return new OllamaLlmInterpreter({
        baseUrl: config.ollamaBaseUrl ?? "http://host.docker.internal:11434",
        model: config.ollamaModel ?? "qwen3:30b-a3b",
      });

    case "openai":
      return new OpenAiLlmInterpreter({
        apiKey: config.openAiApiKey ?? "",
        model: config.openAiModel ?? "qwen2.5:7b",
        baseUrl: config.openAiBaseUrl,
      });

    case "mock":
      return new MockLlmInterpreter();

    default:
      return new MockLlmInterpreter();
  }
}
