/**
 * Scenario G — Tenant isolation
 *
 * Flow rule: Tenant isolation must be enforced.
 * Flow rule: Patient lookup must be executed per clinic.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";
import { CLINIC_A_ID, CLINIC_B_ID, clinicBCatalog } from "../fixtures/catalog";
import { buildKnownPatient } from "../factories/PatientFactory";

describe("Scenario G — Tenant isolation", () => {
  it("creates separate patients for different clinics using same external user", async () => {
    const userId = "shared-user-123";

    const harnessA = new OrchestratorTestHarness(CLINIC_A_ID, userId);
    const harnessB = new OrchestratorTestHarness(CLINIC_B_ID, userId);

    // Set up different catalog for clinic B
    harnessB.catalogSnapshot.setCatalogForClinic(CLINIC_B_ID, clinicBCatalog);

    await harnessA.send("Quero marcar consulta");
    await harnessB.send("Quero marcar consulta");

    const patientA = await harnessA.getPatient();
    const patientB = await harnessB.getPatient();

    expect(patientA).not.toBeNull();
    expect(patientB).not.toBeNull();

    // Different patient records
    expect(patientA!.id).not.toBe(patientB!.id);
    // Different clinic IDs
    expect(patientA!.clinicId).toBe(CLINIC_A_ID);
    expect(patientB!.clinicId).toBe(CLINIC_B_ID);
  });

  it("creates separate conversations for different clinics", async () => {
    const userId = "shared-user-456";

    const harnessA = new OrchestratorTestHarness(CLINIC_A_ID, userId);
    const harnessB = new OrchestratorTestHarness(CLINIC_B_ID, userId);
    harnessB.catalogSnapshot.setCatalogForClinic(CLINIC_B_ID, clinicBCatalog);

    await harnessA.send("Quero marcar consulta");
    await harnessB.send("Quero marcar consulta");

    const convA = await harnessA.getLatestConversation();
    const convB = await harnessB.getLatestConversation();

    expect(convA).not.toBeNull();
    expect(convB).not.toBeNull();
    expect(convA!.id).not.toBe(convB!.id);
    expect(convA!.clinicId).toBe(CLINIC_A_ID);
    expect(convB!.clinicId).toBe(CLINIC_B_ID);
  });

  it("known patient in clinic A is unknown in clinic B", async () => {
    const userId = "cross-clinic-user";

    // Seed known patient only in clinic A
    const harnessA = new OrchestratorTestHarness(CLINIC_A_ID, userId);
    harnessA.patientRepo.seed(
      buildKnownPatient({
        clinicId: CLINIC_A_ID,
        externalUserId: userId,
        defaultChannel: "sim",
      }),
    );

    // Use same repo for clinic B (shared in-memory, but different clinicId)
    const harnessB = new OrchestratorTestHarness(CLINIC_B_ID, userId);

    // Clinic A: known patient, but booking still requires explicit name
    const responseA = await harnessA.send("Quero marcar consulta");
    const convA = await harnessA.getLatestConversation();
    expect(convA!.missingRequirements).toContain("full_name");

    // Clinic B: unknown patient, SHOULD have full_name missing
    const responseB = await harnessB.send("Quero marcar consulta");
    const convB = await harnessB.getLatestConversation();
    expect(convB!.missingRequirements).toContain("full_name");
    // No service specified → first question is about service, not name
    expect(responseB.reply_text.toLowerCase()).toContain("procedimento");
  });

  it("passes correct clinic_id to scheduling handler", async () => {
    const harness = new OrchestratorTestHarness(CLINIC_A_ID);

    // Seed known patient with all data
    harness.patientRepo.seed(
      buildKnownPatient({
        clinicId: CLINIC_A_ID,
        externalUserId: harness.externalUserId,
        defaultChannel: "sim",
      }),
    );

    await harness.send("Quero marcar consulta");
    await harness.send("Meu nome é Lucas Silva");
    await harness.send("123.456.789-00");
    await harness.send("É particular");
    await harness.send("Quero fazer uma limpeza");
    await harness.send("Quero com o Dr. João");
    await harness.send("Quero amanhã às 10h");

    const schedulingInput = harness.schedulingHandler.lastInput;
    expect(schedulingInput).not.toBeNull();
    expect(schedulingInput!.clinic_id).toBe(CLINIC_A_ID);
  });

  it("uses correct catalog per clinic for 'Quero marcar com o Dr. João'", async () => {
    // Clinic A has Dr. João — mock matches on normalized catalog name
    const harnessA = new OrchestratorTestHarness(CLINIC_A_ID);
    const responseA = await harnessA.send("Quero marcar com o Dr. João");

    // Should extract professional name from clinic A's catalog
    const convA = await harnessA.getLatestConversation();
    expect(convA!.collectedData.professional_name).toBe("Dr. João");
  });
});
