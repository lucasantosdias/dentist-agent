import type { AgentToolCall, AgentToolDefinition, AgentToolResult } from "@/modules/ai/domain/AgentTool";

/** A message in the agent conversation. */
export type AgentMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: AgentToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** Result of an agent execution turn. */
export type AgentExecutionResult = {
  /** The final patient-facing text response. */
  response_text: string;
  /** Log of tool calls made during this turn. */
  tool_calls_log: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result: Record<string, unknown>;
  }>;
  /** Number of LLM round-trips in this turn. */
  iterations: number;
};

/** Callback to execute a single tool call. Provided by the orchestrator. */
export type ToolExecutorFn = (call: AgentToolCall) => Promise<AgentToolResult>;

/**
 * Port for the agent execution loop.
 *
 * The agent executor drives the LLM ↔ tool loop:
 * 1. Send messages + tool definitions to LLM
 * 2. If LLM requests tool calls → execute via toolExecutor callback → append results
 * 3. Repeat until LLM produces a text response or maxIterations is reached
 */
export interface AgentExecutorPort {
  execute(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    maxIterations: number,
    toolExecutor: ToolExecutorFn,
  ): Promise<AgentExecutionResult>;
}
