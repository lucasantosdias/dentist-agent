import type {
  AgentExecutorPort,
  AgentMessage,
  AgentExecutionResult,
  ToolExecutorFn,
} from "@/modules/ai/application/ports/AgentExecutorPort";
import type { AgentToolDefinition, AgentToolCall } from "@/modules/ai/domain/AgentTool";

type OpenAiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: OpenAiMessage;
    finish_reason?: string;
  }>;
};

/**
 * Agent executor using OpenAI-compatible /v1/chat/completions with tool calling.
 */
export class OpenAiAgentExecutor implements AgentExecutorPort {
  constructor(
    private readonly config: {
      apiKey: string;
      model: string;
      baseUrl?: string;
      timeoutMs?: number;
    },
  ) {}

  async execute(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    maxIterations: number,
    toolExecutor: ToolExecutorFn,
  ): Promise<AgentExecutionResult> {
    const timeoutMs = this.config.timeoutMs ?? 30_000;
    const baseUrl = (this.config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const endpoint = `${baseUrl}/chat/completions`;
    const toolCallsLog: AgentExecutionResult["tool_calls_log"] = [];

    const chatMessages: OpenAiMessage[] = messages.map((m) => {
      if (m.role === "tool") {
        return { role: "tool" as const, content: m.content, tool_call_id: m.tool_call_id };
      }
      if (m.role === "assistant" && m.tool_calls) {
        return {
          role: "assistant" as const,
          content: m.content,
          tool_calls: m.tool_calls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: tc.function,
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let data: OpenAiChatResponse;
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
            messages: chatMessages,
            tools,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          console.warn(`[AgentExecutor] OpenAI returned ${response.status}`);
          return this.fallbackResponse(toolCallsLog, iteration + 1);
        }

        data = (await response.json()) as OpenAiChatResponse;
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        console.warn(`[AgentExecutor] OpenAI request failed: ${name}`);
        return this.fallbackResponse(toolCallsLog, iteration + 1);
      } finally {
        clearTimeout(timer);
      }

      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) return this.fallbackResponse(toolCallsLog, iteration + 1);

      // No tool calls → check if the model is hallucinating instead of calling a tool
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const text = msg.content?.trim() || "";
        const hasCalledAvailability = toolCallsLog.some((tc) => tc.name === "check_availability");

        if (!hasCalledAvailability && iteration < maxIterations - 1) {
          const stallPattern = /verifican|aguard|um momento|um instante|vou (verificar|checar|consultar|buscar)/i;
          const hallucinatedSlots = /\d{2}[:/]\d{2}.*\d{2}\/\d{2}|\d{2}\/\d{2}.*\d{2}[:/]\d{2}|às \d{2}:\d{2}|horários disponíveis/i;

          if (stallPattern.test(text) || hallucinatedSlots.test(text)) {
            chatMessages.push({ role: "assistant", content: text });
            chatMessages.push({
              role: "user",
              content: "ERRO: você mencionou horários ou datas sem chamar check_availability. Esses dados estão INCORRETOS. Chame check_availability AGORA com os parâmetros corretos. NÃO gere texto.",
            });
            continue;
          }
        }

        return {
          response_text: text || "Como posso te ajudar?",
          tool_calls_log: toolCallsLog,
          iterations: iteration + 1,
        };
      }

      // Process tool calls
      chatMessages.push(msg);

      for (const tc of msg.tool_calls) {
        const toolCall: AgentToolCall = {
          id: tc.id,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        };

        const result = await toolExecutor(toolCall);
        const args = JSON.parse(tc.function.arguments);
        toolCallsLog.push({
          name: tc.function.name,
          arguments: args,
          result: JSON.parse(result.content),
        });

        chatMessages.push({
          role: "tool",
          content: result.content,
          tool_call_id: tc.id,
        });
      }
    }

    // Max iterations reached
    console.warn(`[AgentExecutor] Max iterations (${maxIterations}) reached`);
    return this.fallbackResponse(toolCallsLog, maxIterations);
  }

  private fallbackResponse(
    toolCallsLog: AgentExecutionResult["tool_calls_log"],
    iterations: number,
  ): AgentExecutionResult {
    return {
      response_text: "Desculpa, estou com dificuldade para processar agora. Pode repetir?",
      tool_calls_log: toolCallsLog,
      iterations,
    };
  }
}
