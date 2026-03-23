/**
 * Regression tests for service/procedure informational queries.
 *
 * ROOT PROBLEM: Messages like "como funciona a limpeza?" were classified
 * as UNKNOWN or GREETING, producing generic fallback responses instead of
 * service-specific informational responses.
 *
 * SYSTEMIC FIX:
 * 1. New SERVICE_INFO intent for questions about specific procedures
 * 2. ServiceInfoDetector safety guard in orchestrator
 * 3. handleServiceInfo handler with catalog-aware responses
 *
 * All user messages in Brazilian Portuguese (pt-BR).
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";

describe("Service info queries — intent classification", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it.each([
    "como funciona a limpeza?",
    "o que é clareamento?",
    "como funciona implante?",
    "como é feita a avaliação?",
    "pra que serve avaliação?",
    "me explica sobre o canal",
    "quero saber sobre limpeza",
    "informações sobre clareamento",
  ])("classifies '%s' as SERVICE_INFO", async (text) => {
    await harness.send(text);
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
  });

  it.each([
    "como funciona a limpeza?",
    "o que é clareamento?",
    "como funciona implante?",
    "pra que serve avaliação?",
  ])("NEVER classifies '%s' as GREETING", async (text) => {
    const response = await harness.send(text);
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).not.toBe("GREETING");
    expect(conv!.currentIntent).not.toBe("UNKNOWN");
  });
});

describe("Service info queries — response quality", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("responds with service name and duration for 'como funciona a limpeza?'", async () => {
    const response = await harness.send("como funciona a limpeza?");
    expect(response.reply_text).toContain("Limpeza");
    expect(response.reply_text).toContain("30 minutos");
    expect(response.conversation_state).toBe("AUTO");
  });

  it("responds with service info for 'o que é clareamento?'", async () => {
    const response = await harness.send("o que é clareamento?");
    expect(response.reply_text).toContain("Clareamento");
    expect(response.reply_text).toContain("60 minutos");
  });

  it("responds with service info for 'como funciona implante?'", async () => {
    const response = await harness.send("como funciona implante?");
    expect(response.reply_text).toContain("Implante");
    expect(response.reply_text).toContain("120 minutos");
  });

  it("responds with service info for 'pra que serve avaliação?'", async () => {
    const response = await harness.send("pra que serve avaliação?");
    expect(response.reply_text).toContain("Avaliação");
  });

  it("shows availability after providing service info (availability-first)", async () => {
    const response = await harness.send("como funciona a limpeza?");
    // Should contain service info AND availability data or forward question
    expect(response.reply_text).toContain("Limpeza");
    // Should guide user forward with concrete options, not generic "posso agendar?"
    expect(response.reply_text.toLowerCase()).not.toContain("posso já agendar");
  });

  it("handles generic procedural question without specific service", async () => {
    const response = await harness.send("como é esse procedimento?");
    // Should list available services, not fall to fallback
    expect(response.reply_text.toLowerCase()).toContain("procedimento");
    expect(response.conversation_state).toBe("AUTO");
  });
});

describe("Service info queries — 'dói' disambiguation", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'tratamento de canal dói?' is SERVICE_INFO, not PAIN_OR_URGENT_CASE", async () => {
    await harness.send("tratamento de canal dói?");
    const conv = await harness.getLatestConversation();
    // The user is asking about pain in a procedure, not reporting personal pain
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
  });

  it("'esse procedimento é dolorido?' is SERVICE_INFO", async () => {
    await harness.send("esse procedimento é dolorido?");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
  });

  it("'estou com dor de dente' is still PAIN_OR_URGENT_CASE", async () => {
    await harness.send("estou com dor de dente");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
  });
});

describe("Service info queries — no regression on existing flows", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'Quero marcar consulta' is still BOOK_APPOINTMENT", async () => {
    await harness.send("Quero marcar consulta");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
  });

  it("'Bom dia' is still GREETING", async () => {
    await harness.send("Bom dia");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("GREETING");
  });

  it("'Quero cancelar minha consulta' is still CANCEL_APPOINTMENT", async () => {
    await harness.send("Quero cancelar minha consulta");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("CANCEL_APPOINTMENT");
  });

  it("'Quero falar com atendente' is still TALK_TO_HUMAN", async () => {
    await harness.send("Quero falar com atendente");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("TALK_TO_HUMAN");
  });

  it("scheduling flow still works after asking about a service", async () => {
    // First ask about a service
    await harness.send("como funciona a limpeza?");
    const conv1 = await harness.getLatestConversation();
    expect(conv1!.currentIntent).toBe("SERVICE_INFO");

    // Then start booking — should switch to BOOK_APPOINTMENT
    await harness.send("Quero marcar consulta");
    const conv2 = await harness.getLatestConversation();
    expect(conv2!.currentIntent).toBe("BOOK_APPOINTMENT");
  });

  it("'humm, como funciona a limpeza?' — the original failing case", async () => {
    const response = await harness.send("humm, como funciona a limpeza?");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
    expect(response.reply_text).toContain("Limpeza");
    expect(response.reply_text).not.toContain("bem-vindo");
  });
});
