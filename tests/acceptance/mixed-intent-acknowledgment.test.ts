/**
 * Regression tests for mixed-intent conversational behavior.
 *
 * These test the systemic behavior where a user message contains both
 * a social/greeting component AND a task intent. The system must:
 * 1. Preserve the task flow (deterministic next step)
 * 2. Correctly classify the primary intent (not greeting)
 *
 * Since the orchestrator now returns ResponseDirective facts (no LLM in tests),
 * we validate flow goals, conversation state, and collected data — not exact wording.
 *
 * All user messages in pt-BR.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";

// ─── Greeting + Scheduling ─────────────────────────────────

describe("Mixed intent — greeting + scheduling", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'boa tarde, gostaria de fazer uma limpeza' → booking flow, asks for name", async () => {
    const response = await harness.send("boa tarde, gostaria de fazer uma limpeza");

    // Must not escalate to HUMAN
    expect(response.conversation_state).not.toBe("HUMAN");
    // Intent should be BOOK_APPOINTMENT
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    // Service extracted, next missing field is full_name
    expect(conv!.collectedData.service_code).toBe("LIMPEZA");
    expect(conv!.missingRequirements).toContain("full_name");
  });

  it("'oi, quero agendar avaliação' → booking flow, asks for name", async () => {
    const response = await harness.send("oi, quero agendar avaliação");

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conv!.collectedData.service_code).toBe("AVALIACAO");
    expect(conv!.missingRequirements).toContain("full_name");
  });

  it("'bom dia, quero marcar uma consulta' → booking flow, asks for service", async () => {
    const response = await harness.send("bom dia, quero marcar uma consulta");

    // No service specified → asks which procedure (fact contains "Procedimentos")
    expect(response.reply_text.toLowerCase()).toContain("procedimento");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conv!.missingRequirements).toContain("service_code");
  });

  it("'olá, gostaria de agendar um clareamento' → booking flow, asks for name", async () => {
    await harness.send("olá, gostaria de agendar um clareamento");

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conv!.collectedData.service_code).toBe("CLAREAMENTO");
    expect(conv!.missingRequirements).toContain("full_name");
  });

  it("intent is still BOOK_APPOINTMENT", async () => {
    await harness.send("boa tarde, gostaria de fazer uma limpeza");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
  });

  it("service code is extracted", async () => {
    await harness.send("boa tarde, gostaria de fazer uma limpeza");
    const conv = await harness.getLatestConversation();
    expect(conv!.collectedData.service_code).toBe("LIMPEZA");
  });
});

// ─── Greeting + Informational ──────────────────────────────

describe("Mixed intent — greeting + informational", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'olá, como funciona a limpeza?' → service info, AUTO state", async () => {
    const response = await harness.send("olá, como funciona a limpeza?");

    expect(response.conversation_state).toBe("AUTO");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
  });

  it("'boa noite, o clareamento dói?' → service info", async () => {
    const response = await harness.send("boa noite, o clareamento dói?");

    expect(response.conversation_state).toBe("AUTO");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
  });

  it("intent is SERVICE_INFO, not GREETING", async () => {
    await harness.send("olá, como funciona a limpeza?");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
  });
});

// ─── Greeting + Clinic Info ────────────────────────────────

describe("Mixed intent — greeting + clinic info", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'bom dia, vocês aceitam convênio?' → insurance info with convênio fact", async () => {
    const response = await harness.send("bom dia, vocês aceitam convênio?");

    expect(response.reply_text.toLowerCase()).toContain("convênio");
    expect(response.conversation_state).toBe("AUTO");
  });

  it("'oi, qual o horário de vocês?' → hours info", async () => {
    const response = await harness.send("oi, qual horário de funcionamento?");

    expect(response.reply_text.toLowerCase()).toContain("horário");
    expect(response.conversation_state).toBe("AUTO");
  });
});

// ─── Greeting + Urgency ────────────────────────────────────

describe("Mixed intent — greeting + urgency", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'bom dia, estou com dor' → urgency flow", async () => {
    const response = await harness.send("bom dia, estou com dor");

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
  });

  it("'oi, estou com dor' → urgency flow", async () => {
    const response = await harness.send("oi, estou com dor");

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
  });

  it("'boa noite, meu dente quebrou' → urgency flow", async () => {
    const response = await harness.send("boa noite, meu dente quebrou");

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
  });
});

// ─── No over-acknowledgment ────────────────────────────────

describe("Acknowledgment safeguards", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("pure greeting without task → normal greeting response", async () => {
    const response = await harness.send("Boa tarde");

    expect(response.conversation_state).toBe("AUTO");
    // Reply should be the clinic name fact
    expect(response.reply_text.length).toBeGreaterThan(0);
  });

  it("second turn does NOT get acknowledgment prefix", async () => {
    await harness.send("boa tarde, quero marcar limpeza");
    const r2 = await harness.send("Meu nome é Lucas");

    // Second turn should NOT have a greeting prefix
    expect(r2.reply_text).not.toContain("Boa tarde!");
    expect(r2.reply_text).not.toContain("Oi!");
  });

  it("plain booking without greeting gets no prefix", async () => {
    const response = await harness.send("quero marcar consulta");

    // No greeting prefix
    expect(response.reply_text).not.toMatch(/^(Boa tarde|Bom dia|Boa noite|Olá|Oi)!/);
    // No service specified → asks for service (fact contains "Procedimentos")
    expect(response.reply_text.toLowerCase()).toContain("procedimento");
  });

  it("existing scheduling flow still works after mixed first turn", async () => {
    await harness.send("boa tarde, quero fazer uma limpeza");
    await harness.send("Meu nome é Lucas");
    await harness.send("É particular");

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conv!.collectedData.full_name).toBe("Lucas");
    expect(conv!.collectedData.care_type).toBe("PARTICULAR");
    expect(conv!.collectedData.service_code).toBe("LIMPEZA");
  });
});

// ─── Exact prompt scenarios (Group A) ──────────────────────

describe("Group A — exact prompt scenarios: greeting + scheduling", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'boa noite, gostaria de agendar uma limpeza' → booking flow, asks for name", async () => {
    const response = await harness.send("boa noite, gostaria de agendar uma limpeza");

    expect(response.conversation_state).not.toBe("HUMAN");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conv!.collectedData.service_code).toBe("LIMPEZA");
    expect(conv!.missingRequirements).toContain("full_name");
  });

  it("'boa tarde, quero marcar avaliação' → booking flow, asks for name", async () => {
    const response = await harness.send("boa tarde, quero marcar avaliação");

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conv!.collectedData.service_code).toBe("AVALIACAO");
    expect(conv!.missingRequirements).toContain("full_name");
  });

  it("'oi, gostaria de agendar clareamento' → booking flow, asks for name", async () => {
    const response = await harness.send("oi, gostaria de agendar clareamento");

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conv!.collectedData.service_code).toBe("CLAREAMENTO");
    expect(conv!.missingRequirements).toContain("full_name");
  });
});

// ─── Exact prompt scenarios (Group B) ──────────────────────

describe("Group B — exact prompt scenarios: greeting + informational", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'olá, como funciona a limpeza?' → service info, no booking language", async () => {
    const response = await harness.send("olá, como funciona a limpeza?");

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
    expect(response.conversation_state).toBe("AUTO");
  });

  it("'boa noite, clareamento dói?' → service info", async () => {
    const response = await harness.send("boa noite, clareamento dói?");

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("SERVICE_INFO");
    expect(response.conversation_state).toBe("AUTO");
  });

  it("'bom dia, vocês aceitam convênio?' → insurance info with convênio", async () => {
    const response = await harness.send("bom dia, vocês aceitam convênio?");

    expect(response.reply_text.toLowerCase()).toContain("convênio");
    expect(response.conversation_state).toBe("AUTO");
  });
});

// ─── Exact prompt scenarios (Group C) ──────────────────────

describe("Group C — exact prompt scenarios: greeting + urgency", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'oi, estou com dor' → urgency flow", async () => {
    const response = await harness.send("oi, estou com dor");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
  });

  it("'boa noite, meu dente quebrou' → urgency flow", async () => {
    const response = await harness.send("boa noite, meu dente quebrou");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
  });
});

// ─── Group D — operational conciseness ─────────────────────

describe("Group D — operational responses stay concise", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("second-turn name answer gets no prefix", async () => {
    await harness.send("boa noite, gostaria de agendar limpeza");
    const r2 = await harness.send("Meu nome é Ana");

    expect(r2.reply_text).not.toMatch(/^(Boa noite|Bom dia|Boa tarde|Olá|Oi)!/);
  });

  it("third-turn care_type answer gets no prefix", async () => {
    await harness.send("boa noite, gostaria de agendar limpeza");
    await harness.send("Meu nome é Ana");
    const r3 = await harness.send("É particular");

    expect(r3.reply_text).not.toMatch(/^(Boa noite|Bom dia|Boa tarde|Olá|Oi)!/);
  });

  it("human escalation does not get chatty prefix", async () => {
    const response = await harness.send("boa noite, quero falar com um humano");

    // Should NOT have "Posso te ajudar..." prefix
    expect(response.reply_text).not.toContain("Posso te ajudar");
    // Should escalate
    expect(response.conversation_state).toBe("HUMAN");
  });
});

// ─── Original reported scenario ────────────────────────────

describe("Original reported scenario", () => {
  it("'bom, primeiramente boa tarde, gostaria de fazer uma limpeza' → booking flow", async () => {
    const harness = new OrchestratorTestHarness();
    const response = await harness.send(
      "bom, primeiramente boa tarde, gostaria de fazer uma limpeza",
    );

    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    expect(conv!.collectedData.service_code).toBe("LIMPEZA");
  });
});
