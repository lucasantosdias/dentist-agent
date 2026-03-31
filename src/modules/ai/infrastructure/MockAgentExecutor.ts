import type {
  AgentExecutorPort,
  AgentMessage,
  AgentExecutionResult,
  ToolExecutorFn,
} from "@/modules/ai/application/ports/AgentExecutorPort";
import type { AgentToolDefinition, AgentToolCall } from "@/modules/ai/domain/AgentTool";

/**
 * Mock agent executor for testing.
 *
 * Allows tests to pre-program a scenario: a sequence of tool calls
 * followed by a final text response. The executor walks through the
 * scenario, calling toolExecutor for each tool call step.
 */

export type MockAgentStep =
  | { type: "tool_calls"; calls: Array<{ name: string; arguments: Record<string, unknown> }> }
  | { type: "response"; text: string };

export class MockAgentExecutor implements AgentExecutorPort {
  private scenario: MockAgentStep[] = [
    { type: "response", text: "Como posso te ajudar?" },
  ];
  private callCounter = 0;

  setScenario(steps: MockAgentStep[]): void {
    this.scenario = steps;
  }

  async execute(
    _messages: AgentMessage[],
    _tools: AgentToolDefinition[],
    maxIterations: number,
    toolExecutor: ToolExecutorFn,
  ): Promise<AgentExecutionResult> {
    const toolCallsLog: AgentExecutionResult["tool_calls_log"] = [];
    let iterations = 0;

    for (const step of this.scenario) {
      if (iterations >= maxIterations) break;

      if (step.type === "response") {
        return { response_text: step.text, tool_calls_log: toolCallsLog, iterations: iterations + 1 };
      }

      // Execute tool calls
      iterations++;
      for (const call of step.calls) {
        this.callCounter++;
        const toolCall: AgentToolCall = {
          id: `mock-call-${this.callCounter}`,
          function: {
            name: call.name,
            arguments: JSON.stringify(call.arguments),
          },
        };

        const result = await toolExecutor(toolCall);
        toolCallsLog.push({
          name: call.name,
          arguments: call.arguments,
          result: JSON.parse(result.content),
        });
      }
    }

    // If scenario had no response step, return a default
    return {
      response_text: "Como posso te ajudar?",
      tool_calls_log: toolCallsLog,
      iterations,
    };
  }
}
