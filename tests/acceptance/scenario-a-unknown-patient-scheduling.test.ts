/**
 * Scenario A — Unknown patient wants to schedule
 *
 * Flow rule: Intent classification must occur and be stored.
 * Flow rule: When no service is specified, ask for service first (with list).
 * Flow rule: When service IS specified, ask for name.
 * Flow rule: Entity extraction must occur and be stored.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";

describe("Scenario A — Unknown patient wants to schedule", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'Quero marcar consulta' (no service) → asks for service with list", async () => {
    const response = await harness.send("Quero marcar consulta");

    const conversation = await harness.getLatestConversation();
    expect(conversation).not.toBeNull();
    expect(conversation!.currentIntent).toBe("BOOK_APPOINTMENT");

    // No service specified → system must ask which service (with list)
    expect(response.reply_text.toLowerCase()).toContain("procedimento");
    expect(response.conversation_state).toBe("AUTO");
    expect(conversation!.missingRequirements).toContain("service_code");
  });

  it("'Quero marcar uma limpeza' (with service) → asks for name", async () => {
    const response = await harness.send("Quero marcar uma limpeza");

    const conversation = await harness.getLatestConversation();
    expect(conversation!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conversation!.collectedData.service_code).toBe("LIMPEZA");

    // Service known → next missing field is full_name
    const conv2 = await harness.getLatestConversation();
    expect(conv2!.missingRequirements).toContain("full_name");
  });

  it("'Gostaria de agendar uma consulta' (no service) → asks for service", async () => {
    const response = await harness.send("Gostaria de agendar uma consulta");

    const conversation = await harness.getLatestConversation();
    expect(conversation!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(response.reply_text.toLowerCase()).toContain("procedimento");
  });

  it("'Preciso marcar dentista' (no service) → asks for service", async () => {
    const response = await harness.send("Preciso marcar dentista");

    const conversation = await harness.getLatestConversation();
    expect(conversation!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(response.reply_text.toLowerCase()).toContain("procedimento");
  });

  it("creates patient as LEAD_NEW on first interaction", async () => {
    await harness.send("Quero marcar consulta");

    const patient = await harness.getPatient();
    expect(patient).not.toBeNull();
    expect(patient!.state).toBe("LEAD_NEW");
    expect(patient!.fullName).toBeNull();
  });

  it("stores funnel step as COLLECTING_DATA", async () => {
    await harness.send("Quero marcar consulta");

    const conversation = await harness.getLatestConversation();
    expect(conversation!.currentFunnelStep).toBe("COLLECTING_DATA");
  });
});
