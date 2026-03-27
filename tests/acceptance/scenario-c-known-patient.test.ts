/**
 * Scenario C — Known patient
 *
 * Flow rule: Even known patients must confirm name and CPF for bookings.
 * Flow rule: Patient lookup must be executed per clinic.
 * Flow rule: Patient state is preserved (not regressed).
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

  it("asks for name even for known patients (booking requires explicit confirmation)", async () => {
    await harness.send("Quero marcar consulta");

    const conversation = await harness.getLatestConversation();
    // Booking always requires explicit name collection
    expect(conversation!.missingRequirements).toContain("full_name");

    // Patient state should remain LEAD_QUALIFIED (not regressed)
    const patient = await harness.getPatient();
    expect(patient!.state).toBe("LEAD_QUALIFIED");
    expect(patient!.fullName).toBe("Lucas Silva");
  });

  it("accepts name when provided and moves to next field", async () => {
    await harness.send("Quero marcar consulta");
    await harness.send("Meu nome é Lucas Silva");

    const conversation = await harness.getLatestConversation();
    expect(conversation!.collectedData.full_name).toBe("Lucas Silva");
    expect(conversation!.missingRequirements).not.toContain("full_name");
  });

  it("works with 'Gostaria de agendar uma consulta' for known patient", async () => {
    await harness.send("Gostaria de agendar uma consulta");

    const conversation = await harness.getLatestConversation();
    // Name must still be collected explicitly for booking
    expect(conversation!.missingRequirements).toContain("full_name");
  });
});
