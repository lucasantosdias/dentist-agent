import type {
  AgentExecutorPort,
  AgentMessage,
  AgentExecutionResult,
  ToolExecutorFn,
} from "@/modules/ai/application/ports/AgentExecutorPort";
import type { AgentToolDefinition, AgentToolCall } from "@/modules/ai/domain/AgentTool";

type OllamaChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
};

type OllamaChatResponse = {
  message?: OllamaChatMessage;
  done: boolean;
};

/** Strip qwen3 &lt;think&gt;...&lt;/think&gt; blocks from response text */
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Agent executor using Ollama's /api/chat with native tool calling.
 *
 * Loop:
 * 1. Send messages + tools to Ollama
 * 2. If response contains tool_calls → execute each → append results
 * 3. Repeat until text response or maxIterations reached
 */
export class OllamaAgentExecutor implements AgentExecutorPort {
  constructor(
    private readonly config: {
      baseUrl: string;
      model: string;
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
    const endpoint = `${this.config.baseUrl.replace(/\/$/, "")}/api/chat`;
    const toolCallsLog: AgentExecutionResult["tool_calls_log"] = [];
    let callIdCounter = 0;

    // Build mutable messages array for the conversation
    const chatMessages: OllamaChatMessage[] = messages.map((m) => {
      if (m.role === "tool") {
        return { role: "tool" as const, content: m.content };
      }
      return { role: m.role, content: m.content };
    });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let data: OllamaChatResponse;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.config.model,
            stream: false,
            options: { temperature: 0.7 },
            messages: chatMessages,
            tools,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          console.warn(`[AgentExecutor] Ollama returned ${response.status}`);
          return this.fallbackResponse(toolCallsLog, iteration + 1);
        }

        data = (await response.json()) as OllamaChatResponse;
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        console.warn(`[AgentExecutor] Ollama request failed: ${name}`);
        return this.fallbackResponse(toolCallsLog, iteration + 1);
      } finally {
        clearTimeout(timer);
      }

      const msg = data.message;
      if (!msg) {
        return this.fallbackResponse(toolCallsLog, iteration + 1);
      }

      // If no tool calls → check if the model is hallucinating instead of calling a tool
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const text = stripThinkTags(msg.content?.trim() || "");
        const hasCalledAvailability = toolCallsLog.some((tc) => tc.name === "check_availability");

        if (!hasCalledAvailability && iteration < maxIterations - 1) {
          // Detect stalling ("vou verificar") or hallucinated slots (dates/times without tool call)
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
      chatMessages.push({
        role: "assistant",
        content: msg.content || "",
        tool_calls: msg.tool_calls,
      });

      for (const tc of msg.tool_calls) {
        callIdCounter++;
        const toolCall: AgentToolCall = {
          id: `call-${callIdCounter}`,
          function: {
            name: tc.function.name,
            arguments: JSON.stringify(tc.function.arguments),
          },
        };

        const result = await toolExecutor(toolCall);
        toolCallsLog.push({
          name: tc.function.name,
          arguments: tc.function.arguments,
          result: JSON.parse(result.content),
        });

        chatMessages.push({
          role: "tool",
          content: result.content,
        });
      }
    }

    // Max iterations reached — force a text response without tools
    console.warn(`[AgentExecutor] Max iterations (${maxIterations}) reached, forcing text response`);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          stream: false,
          options: { temperature: 0.7 },
          messages: [
            ...chatMessages,
            { role: "user", content: "Responda ao paciente agora com base nas informações que você já tem. NÃO chame mais ferramentas." },
          ],
          // No tools parameter → forces text response
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const data = (await response.json()) as OllamaChatResponse;
        const text = stripThinkTags(data.message?.content?.trim() ?? "");
        if (text) {
          return { response_text: text, tool_calls_log: toolCallsLog, iterations: maxIterations + 1 };
        }
      }
    } catch { /* fall through */ }

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
