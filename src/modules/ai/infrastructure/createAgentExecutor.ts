import type { AgentExecutorPort } from "@/modules/ai/application/ports/AgentExecutorPort";
import { OllamaAgentExecutor } from "./OllamaAgentExecutor";
import { OpenAiAgentExecutor } from "./OpenAiAgentExecutor";
import { MockAgentExecutor } from "./MockAgentExecutor";

type CreateAgentExecutorConfig = {
  provider: "ollama" | "openai" | "mock";
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
};

export function createAgentExecutor(config: CreateAgentExecutorConfig): AgentExecutorPort {
  switch (config.provider) {
    case "ollama":
      return new OllamaAgentExecutor({
        baseUrl: config.ollamaBaseUrl ?? "http://localhost:11434",
        model: config.ollamaModel ?? "qwen3:30b-a3b",
      });

    case "openai":
      return new OpenAiAgentExecutor({
        apiKey: config.openAiApiKey ?? "",
        model: config.openAiModel ?? "gpt-4o-mini",
        baseUrl: config.openAiBaseUrl,
      });

    case "mock":
      return new MockAgentExecutor();

    default:
      return new MockAgentExecutor();
  }
}
