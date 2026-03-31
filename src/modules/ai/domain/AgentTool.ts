/**
 * Agent tool type definitions.
 *
 * These types define the contract between the agent executor (LLM loop)
 * and the tool executor (business logic dispatcher).
 */

/** JSON Schema property for a tool parameter. */
export type AgentToolParameterProperty = {
  type: "string" | "number" | "boolean" | "array";
  description: string;
  enum?: string[];
  items?: { type: string };
};

/** JSON-Schema-based tool definition, compatible with Ollama and OpenAI tool calling. */
export type AgentToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, AgentToolParameterProperty>;
      required: string[];
    };
  };
};

/** A tool call requested by the LLM. */
export type AgentToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string; // JSON string — parsed by the executor
  };
};

/** The result of executing a tool, fed back to the LLM. */
export type AgentToolResult = {
  tool_call_id: string;
  content: string; // JSON-stringified result
};
