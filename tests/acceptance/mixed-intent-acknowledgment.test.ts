/**
 * Regression tests for mixed-intent conversational acknowledgment.
 *
 * These test the systemic behavior where a user message contains both
 * a social/greeting component AND a task intent. The system must:
 * 1. Preserve the task flow (deterministic next step)
 * 2. Acknowledge the greeting/social signal in the response
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

  it("'boa tarde, gostaria de fazer uma limpeza' → acknowledges + asks name", async () => {
    const response = await harness.send("boa tarde, gostaria de fazer uma limpeza");

    // Must acknowledge greeting
    expect(response.reply_text).toContain("Boa tarde!");
    // Must still ask for the next required field
    expect(response.reply_text.toLowerCase()).toContain("nome");
    // Must not escalate to HUMAN
    expect(response.conversation_state).not.toBe("HUMAN");
  });

  it("'oi, quero agendar avaliação' → acknowledges + asks name", async () => {
    const response = await harness.send("oi, quero agendar avaliação");

    expect(response.reply_text).toContain("Oi!");
    expect(response.reply_text.toLowerCase()).toContain("nome");
  });

  it("'bom dia, quero marcar uma consulta' → acknowledges + asks for service", async () => {
    const response = await harness.send("bom dia, quero marcar uma consulta");

    expect(response.reply_text).toContain("Bom dia!");
    // No service specified → asks which procedure
    expect(response.reply_text.toLowerCase()).toContain("procedimento");
  });

  it("'olá, gostaria de agendar um clareamento' → acknowledges + asks name", async () => {
    const response = await harness.send("olá, gostaria de agendar um clareamento");

    expect(response.reply_text).toContain("Olá!");
    expect(response.reply_text.toLowerCase()).toContain("nome");
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

  it("'olá, como funciona a limpeza?' → acknowledges + service info", async () => {
    const response = await harness.send("olá, como funciona a limpeza?");

    expect(response.reply_text).toContain("Olá!");
    expect(response.conversation_state).toBe("AUTO");
  });

  it("'boa noite, o clareamento dói?' → acknowledges + service info", async () => {
    const response = await harness.send("boa noite, o clareamento dói?");

    expect(response.reply_text).toContain("Boa noite!");
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

  it("'bom dia, vocês aceitam convênio?' → acknowledges + answers", async () => {
    const response = await harness.send("bom dia, vocês aceitam convênio?");

    expect(response.reply_text).toContain("Bom dia!");
    expect(response.reply_text.toLowerCase()).toContain("convênio");
  });

  it("'oi, qual o horário de vocês?' → acknowledges + answers", async () => {
    const response = await harness.send("oi, qual horário de funcionamento?");

    expect(response.reply_text).toContain("Oi!");
    expect(response.reply_text).toContain("horário");
  });
});

// ─── Greeting + Urgency ────────────────────────────────────

describe("Mixed intent — greeting + urgency", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'bom dia, estou com dor' → empathetic ack + urgency flow", async () => {
    const response = await harness.send("bom dia, estou com dor");

    expect(response.reply_text).toContain("Bom dia!");
    expect(response.reply_text).toContain("tranquilo");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
  });

  it("'oi, estou com dor' → empathetic ack + urgency", async () => {
    const response = await harness.send("oi, estou com dor");

    expect(response.reply_text).toContain("Oi!");
    expect(response.reply_text).toContain("tranquilo");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
  });

  it("'boa noite, meu dente quebrou' → urgency with ack", async () => {
    const response = await harness.send("boa noite, meu dente quebrou");

    expect(response.reply_text).toContain("Boa noite!");
    expect(response.reply_text).toContain("tranquilo");
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

  it("pure greeting without task → normal greeting response (no double greeting)", async () => {
    const response = await harness.send("Boa tarde");

    // Should be a normal greeting, not "Boa tarde! Boa tarde!"
    const greetingCount = (response.reply_text.match(/Boa tarde/gi) || []).length;
    expect(greetingCount).toBeLessThanOrEqual(1);
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
    // No service specified → asks for service
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

  it("'boa noite, gostaria de agendar uma limpeza' → ack + name question", async () => {
    const response = await harness.send("boa noite, gostaria de agendar uma limpeza");

    expect(response.reply_text).toContain("Boa noite!");
    expect(response.reply_text.toLowerCase()).toContain("nome");
    expect(response.conversation_state).not.toBe("HUMAN");
  });

  it("'boa tarde, quero marcar avaliação' → ack + name question", async () => {
    const response = await harness.send("boa tarde, quero marcar avaliação");

    expect(response.reply_text).toContain("Boa tarde!");
    expect(response.reply_text.toLowerCase()).toContain("nome");
  });

  it("'oi, gostaria de agendar clareamento' → ack + name question", async () => {
    const response = await harness.send("oi, gostaria de agendar clareamento");

    expect(response.reply_text).toContain("Oi!");
    expect(response.reply_text.toLowerCase()).toContain("nome");
  });
});

// ─── Exact prompt scenarios (Group B) ──────────────────────

describe("Group B — exact prompt scenarios: greeting + informational", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'olá, como funciona a limpeza?' → no redundant service in prefix", async () => {
    const response = await harness.send("olá, como funciona a limpeza?");

    expect(response.reply_text).toContain("Olá!");
    // Should NOT say "Posso te ajudar com..." since handler already names the service
    expect(response.reply_text).not.toContain("agendamento");
  });

  it("'boa noite, clareamento dói?' → greeting + service info", async () => {
    const response = await harness.send("boa noite, clareamento dói?");

    expect(response.reply_text).toContain("Boa noite!");
    expect(response.reply_text).not.toContain("agendamento");
  });

  it("'bom dia, vocês aceitam convênio?' → greeting + insurance info", async () => {
    const response = await harness.send("bom dia, vocês aceitam convênio?");

    expect(response.reply_text).toContain("Bom dia!");
    expect(response.reply_text.toLowerCase()).toContain("convênio");
  });
});

// ─── Exact prompt scenarios (Group C) ──────────────────────

describe("Group C — exact prompt scenarios: greeting + urgency", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  it("'oi, estou com dor' → empathetic prefix", async () => {
    const response = await harness.send("oi, estou com dor");
    expect(response.reply_text).toContain("Oi!");
    expect(response.reply_text).toContain("tranquilo");
  });

  it("'boa noite, meu dente quebrou' → empathetic prefix", async () => {
    const response = await harness.send("boa noite, meu dente quebrou");
    expect(response.reply_text).toContain("Boa noite!");
    expect(response.reply_text).toContain("tranquilo");
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

    // Should NOT have "Boa noite! Posso te ajudar..." prefix
    expect(response.reply_text).not.toContain("Posso te ajudar");
    // Should escalate
    expect(response.conversation_state).toBe("HUMAN");
  });
});

// ─── Original reported scenario ────────────────────────────

describe("Original reported scenario", () => {
  it("'bom, primeiramente boa tarde, gostaria de fazer uma limpeza' → natural response", async () => {
    const harness = new OrchestratorTestHarness();
    const response = await harness.send(
      "bom, primeiramente boa tarde, gostaria de fazer uma limpeza",
    );

    expect(response.reply_text).toContain("Boa tarde!");
    expect(response.reply_text.toLowerCase()).toContain("nome");
    const conv = await harness.getLatestConversation();
    expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
  });
});
