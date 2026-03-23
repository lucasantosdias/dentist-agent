/**
 * Scenario B — Patient provides name
 *
 * Flow rule: Patient name response must create a lead and resume flow.
 * Flow rule: Entity extraction must occur and be stored.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";

describe("Scenario B — Patient provides name", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("stores name and transitions to LEAD_QUALIFIED after 'Meu nome é Lucas'", async () => {
    // Step 1: trigger booking
    await harness.send("Quero marcar consulta");

    // Step 2: provide name
    const response = await harness.send("Meu nome é Lucas");

    // Patient must have name stored
    const patient = await harness.getPatient();
    expect(patient).not.toBeNull();
    expect(patient!.fullName).toBe("Lucas");

    // Patient state must transition to LEAD_QUALIFIED
    expect(patient!.state).toBe("LEAD_QUALIFIED");

    // Conversation must store the name in collected data
    const conversation = await harness.getLatestConversation();
    expect(conversation!.collectedData.full_name).toBe("Lucas");

    // Flow must resume — should ask next missing field (care_type or service)
    expect(response.conversation_state).toBe("AUTO");
    // full_name should no longer be missing
    expect(conversation!.missingRequirements).not.toContain("full_name");
  });

  it("handles 'Me chamo Ana Silva' as name input", async () => {
    await harness.send("Quero marcar consulta");
    await harness.send("Me chamo Ana Silva");

    const patient = await harness.getPatient();
    expect(patient!.fullName).toBe("Ana Silva");
    expect(patient!.state).toBe("LEAD_QUALIFIED");
  });

  it("resumes booking flow after name is collected — asks for next field", async () => {
    await harness.send("Quero marcar consulta");
    const response = await harness.send("Meu nome é Lucas");

    // Should ask for care_type (next in priority for booking)
    const conversation = await harness.getLatestConversation();
    expect(conversation!.missingRequirements.length).toBeGreaterThan(0);
    expect(conversation!.missingRequirements).not.toContain("full_name");
  });
});
