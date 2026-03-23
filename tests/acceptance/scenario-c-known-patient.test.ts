/**
 * Scenario C — Known patient
 *
 * Flow rule: Known patients must not be asked for name again.
 * Flow rule: Patient lookup must be executed per clinic.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";
import { buildKnownPatient } from "../factories/PatientFactory";
import { CLINIC_A_ID } from "../fixtures/catalog";

describe("Scenario C — Known patient", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();

    // Seed a known patient for this user/clinic
    const knownPatient = buildKnownPatient({
      clinicId: CLINIC_A_ID,
      externalUserId: harness.externalUserId,
      defaultChannel: "sim",
    });
    harness.patientRepo.seed(knownPatient);
  });

  it("recognizes known patient and does NOT ask for name", async () => {
    const response = await harness.send("Quero marcar consulta");

    // Should NOT ask for name
    const conversation = await harness.getLatestConversation();
    expect(conversation!.missingRequirements).not.toContain("full_name");

    // Collected data should already have the name
    expect(conversation!.collectedData.full_name).toBe("Lucas Silva");

    // Patient state should remain LEAD_QUALIFIED (not regressed)
    const patient = await harness.getPatient();
    expect(patient!.state).toBe("LEAD_QUALIFIED");
    expect(patient!.fullName).toBe("Lucas Silva");
  });

  it("asks for care_type or service instead of name", async () => {
    const response = await harness.send("Quero marcar consulta");

    // The reply should ask for care_type or service, not name
    const conversation = await harness.getLatestConversation();
    const missingFields = conversation!.missingRequirements;
    expect(missingFields.length).toBeGreaterThan(0);
    expect(missingFields[0]).not.toBe("full_name");
  });

  it("works with 'Gostaria de agendar uma consulta' for known patient", async () => {
    const response = await harness.send("Gostaria de agendar uma consulta");

    const conversation = await harness.getLatestConversation();
    expect(conversation!.missingRequirements).not.toContain("full_name");
    expect(conversation!.collectedData.full_name).toBe("Lucas Silva");
  });
});
