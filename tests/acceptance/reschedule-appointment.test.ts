/**
 * Rescheduling flow tests.
 *
 * All user messages in pt-BR.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";
import { buildKnownPatient } from "../factories/PatientFactory";
import { CLINIC_A_ID } from "../fixtures/catalog";

/** Create a harness with a pre-identified patient (name + CPF set) */
function harnessWithIdentifiedPatient() {
  const harness = new OrchestratorTestHarness();
  harness.patientRepo.seed(
    buildKnownPatient({
      clinicId: CLINIC_A_ID,
      externalUserId: harness.externalUserId,
      defaultChannel: "sim",
      cpf: "12345678900",
    }),
  );
  return harness;
}

describe("Reschedule — intent detection", () => {
  it("'quero remarcar minha consulta' → detected as RESCHEDULE_APPOINTMENT", async () => {
    const harness = new OrchestratorTestHarness();
    await harness.send("quero remarcar minha consulta");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("RESCHEDULE_APPOINTMENT");
  });

  it("'preciso reagendar' → detected as RESCHEDULE_APPOINTMENT", async () => {
    const harness = new OrchestratorTestHarness();
    await harness.send("preciso reagendar");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("RESCHEDULE_APPOINTMENT");
  });
});

describe("Reschedule — collects identity before lookup", () => {
  it("asks for name if not known", async () => {
    const harness = new OrchestratorTestHarness();
    const response = await harness.send("quero remarcar minha consulta");
    expect(response.reply_text.toLowerCase()).toContain("nome");
  });

  it("asks for CPF after name is provided", async () => {
    const harness = new OrchestratorTestHarness();
    await harness.send("quero remarcar minha consulta");
    const response = await harness.send("Meu nome é Lena Laos");
    expect(response.reply_text.toLowerCase()).toContain("cpf");
  });

  it("proceeds to lookup after CPF is provided", async () => {
    const harness = new OrchestratorTestHarness();
    harness.rescheduleHandler.setResult({ kind: "NO_APPOINTMENTS" });

    await harness.send("quero remarcar minha consulta");
    await harness.send("Meu nome é Lena Laos");
    const response = await harness.send("35151204831");

    // Now the handler was called (NO_APPOINTMENTS is the stub default)
    expect(response.reply_text.toLowerCase()).toContain("não há agendamentos");
  });
});

describe("Reschedule — with identified patient", () => {
  it("no appointments found → offers to book new", async () => {
    const harness = harnessWithIdentifiedPatient();
    harness.rescheduleHandler.setResult({ kind: "NO_APPOINTMENTS" });

    const response = await harness.send("quero remarcar minha consulta");
    expect(response.reply_text.toLowerCase()).toContain("não há agendamentos");
    expect(response.conversation_state).toBe("AUTO");
  });

  it("single appointment found, no new datetime → asks for new date", async () => {
    const harness = harnessWithIdentifiedPatient();
    harness.rescheduleHandler.setResult({
      kind: "NEEDS_NEW_DATETIME",
      current_appointment: {
        id: "apt-1",
        starts_at_iso: "2026-03-25T10:00:00-03:00",
        service_code: "LIMPEZA",
        professional_name: "Dra. Ana",
      },
    });

    const response = await harness.send("quero remarcar minha consulta");
    expect(response.reply_text).toContain("Dra. Ana");
    expect(response.reply_text).toContain("LIMPEZA");
    // The system presents the found appointment and will ask for new datetime
    expect(response.reply_text.toLowerCase()).toContain("agendamento encontrado");
  });

  it("successful reschedule → confirms with new time and professional name", async () => {
    const harness = harnessWithIdentifiedPatient();
    harness.rescheduleHandler.setResult({
      kind: "RESCHEDULED",
      old_appointment: {
        id: "apt-1",
        starts_at_iso: "2026-03-25T10:00:00-03:00",
        service_code: "LIMPEZA",
        professional_name: "Dra. Ana",
      },
      new_appointment: {
        id: "apt-2",
        status: "CONFIRMED",
        starts_at_iso: "2026-03-26T14:00:00-03:00",
        ends_at_iso: "2026-03-26T14:30:00-03:00",
        service_code: "LIMPEZA",
        professional_name: "Dra. Ana",
      },
    });

    const response = await harness.send("quero remarcar minha consulta");
    expect(response.reply_text.toLowerCase()).toContain("reagendado");
    expect(response.reply_text).toContain("Dra. Ana");
    expect(response.appointment).toBeDefined();
    expect(response.appointment!.id).toBe("apt-2");
  });
});

describe("Reschedule — disambiguation", () => {
  it("multiple appointments → asks which one", async () => {
    const harness = harnessWithIdentifiedPatient();
    harness.rescheduleHandler.setResult({
      kind: "NEEDS_CLARIFICATION",
      options: [
        { appointment_id: "apt-1", starts_at_iso: "2026-03-25T10:00:00-03:00", service_code: "LIMPEZA", professional_name: "Dra. Ana" },
        { appointment_id: "apt-2", starts_at_iso: "2026-03-27T14:00:00-03:00", service_code: "CLAREAMENTO", professional_name: "Dr. João" },
      ],
    });

    const response = await harness.send("preciso reagendar");
    expect(response.reply_text).toContain("LIMPEZA");
    expect(response.reply_text).toContain("CLAREAMENTO");
  });
});

describe("Reschedule — slot unavailable", () => {
  it("requested slot unavailable → offers alternatives", async () => {
    const harness = harnessWithIdentifiedPatient();
    harness.rescheduleHandler.setResult({
      kind: "SLOT_UNAVAILABLE",
      current_appointment: {
        id: "apt-1",
        starts_at_iso: "2026-03-25T10:00:00-03:00",
        service_code: "LIMPEZA",
        professional_name: "Dra. Ana",
      },
    });

    const response = await harness.send("preciso reagendar pra sexta às 10h");
    expect(response.reply_text.toLowerCase()).toContain("disponível");
  });
});

describe("Reschedule — does NOT break existing flows", () => {
  it("'quero marcar consulta' is still BOOK_APPOINTMENT", async () => {
    const harness = new OrchestratorTestHarness();
    await harness.send("quero marcar consulta");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
  });

  it("'quero cancelar' is still CANCEL_APPOINTMENT", async () => {
    const harness = new OrchestratorTestHarness();
    await harness.send("quero cancelar minha consulta");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("CANCEL_APPOINTMENT");
  });

  it("greeting still works", async () => {
    const harness = new OrchestratorTestHarness();
    const response = await harness.send("boa tarde");
    expect(response.conversation_state).toBe("AUTO");
  });
});

describe("Reschedule — conversational continuity", () => {
  it("does not ask for name/service/professional when patient is identified", async () => {
    const harness = harnessWithIdentifiedPatient();
    harness.rescheduleHandler.setResult({
      kind: "NEEDS_NEW_DATETIME",
      current_appointment: {
        id: "apt-1",
        starts_at_iso: "2026-03-25T10:00:00-03:00",
        service_code: "LIMPEZA",
        professional_name: "Dra. Ana",
      },
    });

    const response = await harness.send("preciso reagendar");
    expect(response.reply_text.toLowerCase()).not.toContain("qual procedimento");
    // The system found the appointment and presents it (asking for new datetime)
    expect(response.reply_text.toLowerCase()).toContain("agendamento encontrado");
  });
});

describe("Reschedule — tenant isolation", () => {
  it("reschedule handler receives correct clinic_id", async () => {
    const harness = harnessWithIdentifiedPatient();
    harness.rescheduleHandler.setResult({ kind: "NO_APPOINTMENTS" });
    await harness.send("quero remarcar");

    expect(harness.rescheduleHandler.lastInput).not.toBeNull();
    expect(harness.rescheduleHandler.lastInput!.clinic_id).toBe(CLINIC_A_ID);
  });
});
