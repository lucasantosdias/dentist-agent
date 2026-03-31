/**
 * Systemic regression tests for conversational level/mode classification.
 *
 * These tests verify the system correctly distinguishes between:
 * - Group A: Opening / presence-check (first turn)
 * - Group B: Service / procedure informational queries
 * - Group C: Explicit human handoff
 * - Group D: Escalation after repeated failures
 * - Group E: Regression safety for existing flows
 *
 * All simulated user messages in pt-BR.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";

// ─── Group A: Opening / help-seeking on first turn ─────────

describe("Group A — Opening / presence-check on first turn", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it.each([
    "alguem por ai?",
    "tem alguém aí?",
    "oi",
    "boa tarde",
    "bom dia",
    "consegue me ajudar?",
    "tem como me atender?",
    "olá",
  ])("'%s' on first turn → GREETING (not HUMAN)", async (text) => {
    const response = await harness.send(text);
    expect(response.conversation_state).toBe("AUTO");
    expect(response.conversation_state).not.toBe("HUMAN");
  });

  it.each([
    "alguem por ai?",
    "tem alguém aí?",
    "consegue me ajudar?",
    "tem como me atender?",
  ])("'%s' on first turn → produces a help-oriented response", async (text) => {
    const response = await harness.send(text);
    // Should NOT contain human-handoff phrasing
    expect(response.reply_text.toLowerCase()).not.toContain("encaminhar");
    // Should be welcoming
    expect(response.reply_text.length).toBeGreaterThan(10);
    expect(response.conversation_state).toBe("AUTO");
  });

  it.each([
    "preciso de ajuda",
    "quero atendimento",
  ])("'%s' → SMALL_TALK (guided help), not BOOK_APPOINTMENT", async (text) => {
    await harness.send(text);
    const conv = await harness.getLatestConversation();
    // Should NOT be treated as a concrete booking request
    expect(conv!.currentIntent).not.toBe("BOOK_APPOINTMENT");
    expect(conv!.currentIntent).toBe("SMALL_TALK");
  });

  it("'vocês atendem?' on first turn → NOT human handoff", async () => {
    const response = await harness.send("vocês atendem?");
    expect(response.conversation_state).toBe("AUTO");
    // Should not contain handoff language
    expect(response.reply_text.toLowerCase()).not.toContain("atendente humano");
  });
});

// ─── Group B: Service / procedure informational queries ────

describe("Group B — Service / procedure informational queries", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it.each([
    "como funciona a limpeza?",
    "o que é clareamento?",
    "como funciona implante?",
    "pra que serve avaliação?",
    "me explica sobre o canal",
    "quero saber sobre limpeza",
  ])("'%s' → SERVICE_INFO (not greeting/fallback)", async (text) => {
    await harness.send(text);
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
  });

  it.each([
    "tratamento de canal dói?",
    "esse procedimento é dolorido?",
  ])("'%s' → SERVICE_INFO (not PAIN_OR_URGENT_CASE)", async (text) => {
    await harness.send(text);
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
  });

  it("service info response contains service name", async () => {
    const response = await harness.send("como funciona a limpeza?");
    expect(response.reply_text).toContain("Limpeza");
    expect(response.conversation_state).toBe("AUTO");
  });

  it("'humm, como funciona a limpeza?' → SERVICE_INFO", async () => {
    const response = await harness.send("humm, como funciona a limpeza?");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
    expect(response.reply_text).toContain("Limpeza");
  });
});

// ─── Group C: Explicit human handoff ───────────────────────

describe("Group C — Explicit human handoff", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it.each([
    "quero falar com um humano",
    "me transfere para um atendente",
    "não quero falar com robô",
    "quero falar com a recepção",
    "me passa pra alguém",
  ])("'%s' → TALK_TO_HUMAN → HUMAN state", async (text) => {
    const response = await harness.send(text);
    expect(response.conversation_state).toBe("HUMAN");
  });

  it("explicit handoff works even on first message", async () => {
    const response = await harness.send("quero falar com um humano");
    expect(response.conversation_state).toBe("HUMAN");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("TALK_TO_HUMAN");
  });
});

// ─── Group D: Escalation after repeated failures ───────────

describe("Group D — Escalation after repeated failures", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("fallback message appears after max unknown attempts", async () => {
    await harness.send("??");
    await harness.send("asdf");
    const r3 = await harness.send("xyz");

    // After 3 unknowns, should get escalation fact
    expect(r3.reply_text.toLowerCase()).toContain("múltiplas tentativas");
  });

  it("explicit handoff after failures still works", async () => {
    await harness.send("??");
    await harness.send("asdf");
    await harness.send("nada");

    // Now explicitly request human
    const response = await harness.send("me transfere para um atendente");
    expect(response.conversation_state).toBe("HUMAN");
  });

  it("user can recover from failures with a valid intent", async () => {
    await harness.send("??");
    await harness.send("xyz");

    // Valid booking request should work despite prior failures
    const response = await harness.send("Quero marcar consulta");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    // No service specified → asks for service first
    expect(response.reply_text.toLowerCase()).toContain("procedimento");
  });
});

// ─── Group E: Regression safety ────────────────────────────

describe("Group E — Regression safety", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'Quero marcar consulta' → BOOK_APPOINTMENT", async () => {
    await harness.send("Quero marcar consulta");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
  });

  it("'Quero cancelar minha consulta' → CANCEL_APPOINTMENT", async () => {
    await harness.send("Quero cancelar minha consulta");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("CANCEL_APPOINTMENT");
  });

  it("'estou com dor de dente' → PAIN_OR_URGENT_CASE", async () => {
    await harness.send("estou com dor de dente");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
  });

  it("scheduling flow still works end-to-end", async () => {
    await harness.send("Quero marcar consulta");
    await harness.send("Meu nome é Lucas");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conv!.collectedData.full_name).toBe("Lucas");
  });

  it("service info does not break subsequent booking", async () => {
    await harness.send("como funciona a limpeza?");
    await harness.send("Quero marcar consulta");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
  });

  it("opening then booking works correctly", async () => {
    await harness.send("alguem por ai?");
    const r1 = await harness.getLatestConversation();
    expect(r1!.currentIntent).toBe("GREETING");

    await harness.send("Quero marcar consulta");
    const r2 = await harness.getLatestConversation();
    expect(r2!.currentIntent).toBe("BOOK_APPOINTMENT");
  });

  it("multi-tenant isolation is maintained", async () => {
    const harnessA = new OrchestratorTestHarness("00000000-0000-0000-0000-000000000001", "user-shared");
    const harnessB = new OrchestratorTestHarness("00000000-0000-0000-0000-000000000002", "user-shared");

    await harnessA.send("como funciona a limpeza?");
    await harnessB.send("como funciona a limpeza?");

    const convA = await harnessA.getLatestConversation();
    const convB = await harnessB.getLatestConversation();

    expect(convA).not.toBeNull();
    expect(convB).not.toBeNull();
    expect(convA!.id).not.toBe(convB!.id);
  });
});

// ─── Cross-level: Message meaning changes with context ─────

describe("Cross-level — Context changes message meaning", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'tem alguém aí?' on first turn = greeting, not escalation", async () => {
    const response = await harness.send("tem alguém aí?");
    expect(response.conversation_state).toBe("AUTO");
    // Not escalated
    expect(response.reply_text.toLowerCase()).not.toContain("atendente humano");
  });

  it("actual pain report still triggers urgency", async () => {
    await harness.send("estou com muita dor");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
  });

  it("'quero fazer uma limpeza' is still BOOK_APPOINTMENT", async () => {
    await harness.send("quero fazer uma limpeza");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
  });

  it("'Quero agendar limpeza' is still BOOK_APPOINTMENT", async () => {
    await harness.send("Quero agendar limpeza");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
  });
});
