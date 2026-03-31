/**
 * Tests that clinic settings are used by the orchestrator:
 * - Greeting uses clinic_display_name
 * - Dynamic service list in booking questions
 * - Unknown fallback escalation after max attempts
 * - HOURS_INFO uses clinic-specific hours
 * - TALK_TO_HUMAN uses clinic template
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";
import { ClinicSettings } from "@/modules/clinic/domain/ClinicSettings";
import { CLINIC_A_ID } from "../fixtures/catalog";

describe("Clinic settings integration", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("greeting uses clinic_display_name from settings", async () => {
    const response = await harness.send("Bom dia");
    // Default settings for "Dentzi Test" clinic
    expect(response.reply_text).toContain("Dentzi Test");
  });

  it("HOURS_INFO uses clinic-specific working hours", async () => {
    // Set custom working hours
    harness.clinicSettingsRepo.setSettings(
      CLINIC_A_ID,
      new ClinicSettings({
        id: "s1",
        clinicId: CLINIC_A_ID,
        botName: "Bot Teste",
        clinicDisplayName: "Clínica Teste",
        tone: "casual",
        greetingTemplate: "E aí! Aqui é da {clinic_name}. Como posso ajudar?",
        fallbackMessage: "Não entendi. Quer falar com alguém?",
        workingHourStart: 9,
        workingHourEnd: 18,
        workingDaysText: "segunda a sábado",
        timezone: "America/Sao_Paulo",
        maxUnknownBeforeFallback: 2,
        holdTtlMinutes: 15,
        slotStepMinutes: 30,
        tplAskName: "Como você se chama?",
        tplAskCareType: "Particular ou convênio?",
        tplAskService: "Qual serviço? Temos: {services}.",
        tplAskDatetime: "Quando você quer vir?",
        tplAskProfessional: "Quer escolher o dentista?",
        tplHoldCreated: "Reservei {slot} com {professional}. Confirma?",
        tplAppointmentConfirmed: "Marcado para {datetime}!",
        tplNoSlots: "Sem horários. Outro dia?",
        tplEscalateHuman: "Te passo para um humano, ok?",
      }),
    );

    const response = await harness.send("Qual horário de funcionamento?");
    expect(response.reply_text).toContain("segunda a sábado");
    expect(response.reply_text).toContain("09:00-18:00");
  });

  it("booking question uses dynamic service list from catalog", async () => {
    // The default catalog has: Limpeza, Clareamento, Avaliação, Canal, Implante
    await harness.send("Quero marcar consulta");
    await harness.send("Meu nome é Ana");
    const response = await harness.send("É particular");

    // The next question should ask for service with dynamic list
    expect(response.reply_text).toContain("Limpeza");
    expect(response.reply_text).toContain("Clareamento");
  });

  it("TALK_TO_HUMAN uses clinic escalation template", async () => {
    const response = await harness.send("Quero falar com atendente");
    expect(response.reply_text).toContain("atendente");
    expect(response.conversation_state).toBe("HUMAN");
  });
});

describe("Unknown fallback escalation", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("shows fallback message after max unknown attempts", async () => {
    // Default maxUnknownBeforeFallback is 3
    await harness.send("??");
    await harness.send("asdfg");
    const response3 = await harness.send("xyz123");

    // After 3 attempts, should show the escalation fact
    expect(response3.reply_text.toLowerCase()).toContain("múltiplas tentativas");
  });

  it("custom max_unknown_before_fallback is respected", async () => {
    harness.clinicSettingsRepo.setSettings(
      CLINIC_A_ID,
      new ClinicSettings({
        id: "s1",
        clinicId: CLINIC_A_ID,
        botName: "Bot",
        clinicDisplayName: "Test",
        tone: "warm_professional",
        greetingTemplate: "Olá! Aqui é da {clinic_name}. Em que posso ajudar?",
        fallbackMessage: "Custom fallback: quer um humano?",
        workingHourStart: 8,
        workingHourEnd: 19,
        workingDaysText: "segunda a sexta",
        timezone: "America/Sao_Paulo",
        maxUnknownBeforeFallback: 2,
        holdTtlMinutes: 10,
        slotStepMinutes: 30,
        tplAskName: "Qual é o seu nome completo?",
        tplAskCareType: "Particular ou convênio?",
        tplAskService: "Qual procedimento? Temos: {services}.",
        tplAskDatetime: "Qual data e horário?",
        tplAskProfessional: "Tem preferência de profissional?",
        tplHoldCreated: "Reservei {slot} com {professional} para {service}. CONFIRMO para finalizar.",
        tplAppointmentConfirmed: "Agendamento para {datetime}!",
        tplNoSlots: "Sem horários.",
        tplEscalateHuman: "Passando para humano.",
      }),
    );

    await harness.send("??");
    const response2 = await harness.send("blah");

    // maxUnknown = 2, so after 2nd attempt we get escalation fact
    expect(response2.reply_text.toLowerCase()).toContain("múltiplas tentativas");
  });
});
