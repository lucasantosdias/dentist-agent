import { MockAgentExecutor, type MockAgentStep } from "@/modules/ai/infrastructure/MockAgentExecutor";
import type { AgentToolCall, AgentToolResult } from "@/modules/ai/domain/AgentTool";
import { AGENT_TOOLS } from "@/modules/ai/infrastructure/tools/ToolRegistry";

describe("MockAgentExecutor", () => {
  let executor: MockAgentExecutor;

  beforeEach(() => {
    executor = new MockAgentExecutor();
  });

  it("returns default response when no scenario is set", async () => {
    const result = await executor.execute(
      [{ role: "user", content: "oi" }],
      AGENT_TOOLS,
      5,
      async () => ({ tool_call_id: "1", content: "{}" }),
    );
    expect(result.response_text).toBe("Como posso te ajudar?");
    expect(result.tool_calls_log).toHaveLength(0);
  });

  it("executes tool calls and returns final response", async () => {
    const scenario: MockAgentStep[] = [
      { type: "tool_calls", calls: [{ name: "list_services", arguments: {} }] },
      { type: "response", text: "Temos limpeza e clareamento. Qual te interessa?" },
    ];
    executor.setScenario(scenario);

    const toolResults: Record<string, unknown>[] = [];
    const result = await executor.execute(
      [{ role: "user", content: "quais serviços vocês têm?" }],
      AGENT_TOOLS,
      5,
      async (call: AgentToolCall): Promise<AgentToolResult> => {
        const r = { services: [{ name: "Limpeza" }, { name: "Clareamento" }] };
        toolResults.push(r);
        return { tool_call_id: call.id, content: JSON.stringify(r) };
      },
    );

    expect(result.response_text).toBe("Temos limpeza e clareamento. Qual te interessa?");
    expect(result.tool_calls_log).toHaveLength(1);
    expect(result.tool_calls_log[0].name).toBe("list_services");
    expect(result.iterations).toBe(2);
  });

  it("respects maxIterations", async () => {
    const scenario: MockAgentStep[] = [
      { type: "tool_calls", calls: [{ name: "list_services", arguments: {} }] },
      { type: "tool_calls", calls: [{ name: "check_availability", arguments: {} }] },
      { type: "tool_calls", calls: [{ name: "list_services", arguments: {} }] },
      { type: "response", text: "Final response" },
    ];
    executor.setScenario(scenario);

    const result = await executor.execute(
      [{ role: "user", content: "test" }],
      AGENT_TOOLS,
      2,
      async (call: AgentToolCall): Promise<AgentToolResult> => {
        return { tool_call_id: call.id, content: JSON.stringify({ ok: true }) };
      },
    );

    // Should stop after 2 iterations, not reaching the response step
    expect(result.tool_calls_log).toHaveLength(2);
    expect(result.iterations).toBe(2);
  });

  it("handles multiple tool calls in a single step", async () => {
    const scenario: MockAgentStep[] = [
      {
        type: "tool_calls",
        calls: [
          { name: "list_services", arguments: {} },
          { name: "get_clinic_hours", arguments: {} },
        ],
      },
      { type: "response", text: "Aqui estão nossos serviços e horários." },
    ];
    executor.setScenario(scenario);

    const result = await executor.execute(
      [{ role: "user", content: "test" }],
      AGENT_TOOLS,
      5,
      async (call: AgentToolCall): Promise<AgentToolResult> => {
        return { tool_call_id: call.id, content: JSON.stringify({ ok: true }) };
      },
    );

    expect(result.tool_calls_log).toHaveLength(2);
    expect(result.tool_calls_log[0].name).toBe("list_services");
    expect(result.tool_calls_log[1].name).toBe("get_clinic_hours");
  });
});

describe("AGENT_TOOLS registry", () => {
  it("has 11 tools defined", () => {
    expect(AGENT_TOOLS).toHaveLength(11);
  });

  it("all tools have valid structure", () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters.type).toBe("object");
    }
  });

  it("includes all expected tool names", () => {
    const names = AGENT_TOOLS.map((t) => t.function.name);
    expect(names).toContain("list_services");
    expect(names).toContain("get_service_info");
    expect(names).toContain("check_availability");
    expect(names).toContain("reserve_slot");
    expect(names).toContain("confirm_appointment");
    expect(names).toContain("cancel_appointment");
    expect(names).toContain("confirm_presence");
    expect(names).toContain("reschedule_appointment");
    expect(names).toContain("lookup_knowledge");
    expect(names).toContain("get_clinic_hours");
    expect(names).toContain("escalate_to_human");
  });
});
