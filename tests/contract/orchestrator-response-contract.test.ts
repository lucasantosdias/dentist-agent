/**
 * Contract tests — Ensure orchestrator response conforms to expected schema.
 *
 * Validates that every response includes the required fields:
 * - reply_text (assistantReply — in Portuguese)
 * - conversation_state
 * - patient_state
 * And optionally:
 * - appointment (when booking completes)
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";
import { buildKnownPatient } from "../factories/PatientFactory";
import { CLINIC_A_ID } from "../fixtures/catalog";

describe("Orchestrator response contract", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("always returns reply_text, conversation_state, and patient_state", async () => {
    const response = await harness.send("Quero marcar consulta");

    expect(response).toHaveProperty("reply_text");
    expect(response).toHaveProperty("conversation_state");
    expect(response).toHaveProperty("patient_state");

    expect(typeof response.reply_text).toBe("string");
    expect(response.reply_text.length).toBeGreaterThan(0);
    expect(typeof response.conversation_state).toBe("string");
    expect(typeof response.patient_state).toBe("string");
  });

  it("reply_text is in Portuguese", async () => {
    const response = await harness.send("Quero marcar consulta");

    // Check for Portuguese words (basic heuristic)
    const portugueseIndicators = ["nome", "qual", "você", "nosso", "posso", "ajudar", "olá", "bem-vindo"];
    const hasPortuguese = portugueseIndicators.some((word) =>
      response.reply_text.toLowerCase().includes(word),
    );
    expect(hasPortuguese).toBe(true);
  });

  it("conversation_state is a valid state", async () => {
    const response = await harness.send("Quero marcar consulta");
    expect(["AUTO", "WAITING", "HUMAN", "FINALIZADA"]).toContain(response.conversation_state);
  });

  it("patient_state is a valid state", async () => {
    const response = await harness.send("Quero marcar consulta");
    expect(["LEAD_NEW", "LEAD_QUALIFIED", "LEAD_INACTIVE", "ACTIVE", "INACTIVE"]).toContain(
      response.patient_state,
    );
  });

  it("returns appointment object when scheduling completes", async () => {
    // Seed known patient and stub scheduling to return an appointment
    harness.patientRepo.seed(
      buildKnownPatient({
        clinicId: CLINIC_A_ID,
        externalUserId: harness.externalUserId,
        defaultChannel: "sim",
      }),
    );

    harness.schedulingHandler.setResult({
      reply_text: "Agendamento confirmado para 21/03/2026 às 10:00 com Dr. Pedro.",
      conversation_state: "AUTO",
      appointment: {
        id: "appt-001",
        status: "AGENDADA",
        starts_at: "2026-03-21T10:00:00-03:00",
        ends_at: "2026-03-21T10:30:00-03:00",
        professional_name: "Dr. Pedro",
        service_code: "LIMPEZA",
      },
    });

    // Provide all required data in steps
    await harness.send("Quero marcar consulta");
    await harness.send("É particular");
    await harness.send("Quero fazer uma limpeza");
    await harness.send("Quero com o Dr. João");
    const response = await harness.send("Quero amanhã às 10h");

    expect(response).toHaveProperty("appointment");
    expect(response.appointment).toMatchObject({
      id: expect.any(String),
      status: expect.any(String),
      starts_at: expect.any(String),
      ends_at: expect.any(String),
      professional_name: expect.any(String),
      service_code: expect.any(String),
    });
  });

  it("does NOT return appointment for informational intents", async () => {
    const response = await harness.send("Bom dia");
    expect(response.appointment).toBeUndefined();
  });

  describe("contract for different intent types", () => {
    const intentMessages: Array<{ text: string; expectedState: string }> = [
      { text: "Bom dia", expectedState: "AUTO" },
      { text: "Quero marcar consulta", expectedState: "AUTO" },
      { text: "Quero falar com atendente", expectedState: "HUMAN" },
      { text: "Não sei direito", expectedState: "AUTO" },
    ];

    it.each(intentMessages)(
      "returns valid contract for '$text'",
      async ({ text, expectedState }) => {
        const response = await harness.send(text);

        expect(response.reply_text).toBeTruthy();
        expect(response.conversation_state).toBe(expectedState);
        expect(response.patient_state).toBeTruthy();
      },
    );
  });
});
