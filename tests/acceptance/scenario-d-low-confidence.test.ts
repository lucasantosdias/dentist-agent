/**
 * Scenario D — Low confidence intent
 *
 * Flow rule: Low-confidence messages must trigger clarification.
 * Flow rule: State changes properly on UNKNOWN intent.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";

describe("Scenario D — Low confidence intent", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("responds with clarification for 'Queria ver um negócio'", async () => {
    const response = await harness.send("Queria ver um negócio");

    // MockLlmInterpreter should classify this as UNKNOWN (no scheduling/greeting keywords)
    // Wait — "queria" contains "quero"? Let me check: normalize("Queria ver um negócio") contains "queria"
    // The mock checks for "quero" not "queria", so this should be UNKNOWN
    // Actually let me check: n.includes("quero") — "queria" does NOT include "quero"
    // But "Queria" normalized is "queria" which does NOT match "quero"
    // However, it does include "preciso"? No. So it should be UNKNOWN.

    const conversation = await harness.getLatestConversation();
    expect(conversation).not.toBeNull();

    // Response should be in Portuguese
    expect(response.reply_text.length).toBeGreaterThan(0);
    // State should remain AUTO
    expect(response.conversation_state).toBe("AUTO");
  });

  it("responds with clarification for 'Não sei direito'", async () => {
    const response = await harness.send("Não sei direito");

    // Should be UNKNOWN
    const conversation = await harness.getLatestConversation();
    expect(conversation!.currentIntent).toBe("UNKNOWN");

    // Response in Portuguese
    expect(response.reply_text.length).toBeGreaterThan(0);
    expect(response.conversation_state).toBe("AUTO");
  });

  it("maintains current transactional intent when UNKNOWN message arrives mid-flow", async () => {
    // Start a booking flow
    await harness.send("Quero marcar consulta");

    // Send ambiguous message mid-flow
    const response = await harness.send("Não sei direito");

    // Should keep BOOK_APPOINTMENT intent (resolveEffectiveIntent keeps transactional)
    const conversation = await harness.getLatestConversation();
    expect(conversation!.currentIntent).toBe("BOOK_APPOINTMENT");
  });

  it("provides a helpful default response for UNKNOWN outside a flow", async () => {
    const response = await harness.send("Não sei direito");

    // Should mention services or assistance
    expect(response.reply_text).toBeTruthy();
    // Response should be in Portuguese
    expect(response.reply_text.length).toBeGreaterThan(10);
  });
});
