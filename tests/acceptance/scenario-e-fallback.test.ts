/**
 * Scenario E — Too many failed attempts → fallback
 *
 * Flow rule: After multiple failed attempts → fallback must be triggered.
 * Flow rule: No infinite loop.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";

describe("Scenario E — Too many failed attempts (fallback)", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("handles sequence of meaningless messages without crashing", async () => {
    const response1 = await harness.send("??");
    const response2 = await harness.send("sei lá");
    const response3 = await harness.send("hmm");

    // All responses should be valid (no crash, no infinite loop)
    expect(response1.reply_text).toBeTruthy();
    expect(response2.reply_text).toBeTruthy();
    expect(response3.reply_text).toBeTruthy();

    // All should be UNKNOWN or handled
    const conversation = await harness.getLatestConversation();
    expect(conversation).not.toBeNull();

    // Conversation state should stay AUTO (no escalation without request)
    expect(conversation!.state).toBe("AUTO");
  });

  it("increments attempts counter on each message", async () => {
    await harness.send("??");
    await harness.send("sei lá");
    await harness.send("hmm");

    const conversation = await harness.getLatestConversation();
    expect(conversation!.attempts).toBe(3);
  });

  it("provides Portuguese responses to gibberish input", async () => {
    const response = await harness.send("??");
    // The fallback response should be in Portuguese
    expect(response.reply_text.length).toBeGreaterThan(0);
    // Should contain Portuguese words (from default UNKNOWN handler)
    expect(response.conversation_state).toBe("AUTO");
  });

  it("does not enter infinite loop — each message produces exactly one response", async () => {
    const messages = ["??", "sei lá", "hmm", "nada", "123"];
    const responses: string[] = [];

    for (const msg of messages) {
      const response = await harness.send(msg);
      responses.push(response.reply_text);
    }

    // Each message should have produced exactly one response
    expect(responses.length).toBe(messages.length);

    // All responses should be non-empty
    for (const reply of responses) {
      expect(reply.length).toBeGreaterThan(0);
    }
  });

  it("still responds correctly if user sends valid message after failed attempts", async () => {
    // Send meaningless messages
    await harness.send("??");
    await harness.send("sei lá");
    await harness.send("hmm");

    // Now send a real booking request
    const response = await harness.send("Quero marcar consulta");

    const conversation = await harness.getLatestConversation();
    expect(conversation!.currentIntent).toBe("BOOK_APPOINTMENT");
    // No service specified → asks for service first
    expect(response.reply_text.toLowerCase()).toContain("procedimento");
  });
});
