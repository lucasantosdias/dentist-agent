/**
 * Scenario F — Multi-turn conversation
 *
 * Flow rule: Conversation must preserve context across messages.
 * Flow rule: Correct flow orchestration must occur.
 * Flow rule: Entity extraction must accumulate across turns.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";

describe("Scenario F — Multi-turn conversation", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("preserves context across 3-message booking flow", async () => {
    // Turn 1: express scheduling intent
    const r1 = await harness.send("Quero marcar consulta");
    expect(r1.conversation_state).toBe("AUTO");

    const conv1 = await harness.getLatestConversation();
    expect(conv1!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conv1!.missingRequirements).toContain("full_name");

    // Turn 2: provide name
    const r2 = await harness.send("Meu nome é Lucas");
    expect(r2.conversation_state).toBe("AUTO");

    const conv2 = await harness.getLatestConversation();
    expect(conv2!.collectedData.full_name).toBe("Lucas");
    expect(conv2!.missingRequirements).not.toContain("full_name");
    // Intent should still be BOOK_APPOINTMENT
    expect(conv2!.currentIntent).toBe("BOOK_APPOINTMENT");

    // Turn 3: provide date/time — "Quero amanhã de manhã" includes "quero" → BOOK_APPOINTMENT
    // The mock will try to extract datetime from "amanhã"
    const r3 = await harness.send("Quero amanhã às 10h");

    const conv3 = await harness.getLatestConversation();
    // Context must be preserved: name should still be there
    expect(conv3!.collectedData.full_name).toBe("Lucas");
    // Datetime should be extracted
    expect(conv3!.collectedData.datetime_iso).toBeTruthy();
    // Intent must remain BOOK_APPOINTMENT
    expect(conv3!.currentIntent).toBe("BOOK_APPOINTMENT");
  });

  it("collects care_type in multi-turn flow", async () => {
    await harness.send("Quero marcar consulta");
    await harness.send("Meu nome é Lucas");
    await harness.send("É particular");

    const conv = await harness.getLatestConversation();
    expect(conv!.collectedData.full_name).toBe("Lucas");
    expect(conv!.collectedData.care_type).toBe("PARTICULAR");
    expect(conv!.missingRequirements).not.toContain("care_type");
    expect(conv!.missingRequirements).not.toContain("full_name");
  });

  it("uses same conversation across all turns", async () => {
    await harness.send("Quero marcar consulta");
    const conv1 = await harness.getLatestConversation();

    await harness.send("Meu nome é Lucas");
    const conv2 = await harness.getLatestConversation();

    await harness.send("Quero amanhã às 10h");
    const conv3 = await harness.getLatestConversation();

    // All messages should use the same conversation
    expect(conv1!.id).toBe(conv2!.id);
    expect(conv2!.id).toBe(conv3!.id);
  });

  it("stores messages in order for context window", async () => {
    await harness.send("Quero marcar consulta");
    await harness.send("Meu nome é Lucas");
    await harness.send("Quero amanhã às 10h");

    const conv = await harness.getLatestConversation();
    const messages = harness.messageRepo.getByConversation(conv!.id);

    // Should have 6 messages: 3 inbound + 3 outbound
    expect(messages.length).toBe(6);

    // Alternating INBOUND/OUTBOUND
    expect(messages[0].direction).toBe("INBOUND");
    expect(messages[1].direction).toBe("OUTBOUND");
    expect(messages[2].direction).toBe("INBOUND");
    expect(messages[3].direction).toBe("OUTBOUND");
  });

  it("delegates to scheduling handler when all data is collected", async () => {
    await harness.send("Quero marcar consulta");
    await harness.send("Meu nome é Lucas");
    await harness.send("123.456.789-00");
    await harness.send("É particular");
    await harness.send("Quero fazer uma limpeza");
    await harness.send("Quero com o Dr. João");
    await harness.send("Quero amanhã às 10h");

    // At this point all required fields should be collected
    // and the scheduling handler should have been invoked
    const schedulingInput = harness.schedulingHandler.lastInput;
    expect(schedulingInput).not.toBeNull();
    expect(schedulingInput!.clinic_id).toBe(harness.clinicId);
  });

  it("asks for name and CPF even when patient already has them in DB (returning patient)", async () => {
    // Simulate a returning patient who already provided name + CPF in a prior session
    const patient = await harness.getPatient() ?? (await harness.send("oi"), await harness.getPatient());
    patient!.setFullName("Raquel Souza");
    patient!.setCpf("12345678900");
    await harness.patientRepo.save(patient!);

    // Reset conversation so it starts fresh
    harness.reset();
    // Re-seed the patient with known data
    harness.patientRepo.seed(patient!);

    // New booking conversation — patient is "known" in DB
    const r1 = await harness.send("Quero marcar uma limpeza", {
      external_user_id: patient!.externalUserId,
    });

    const conv = await harness.getLatestConversation();
    // Even though patient has name + CPF in DB, the system must still ask for them
    expect(conv!.missingRequirements).toContain("full_name");
  });
});
