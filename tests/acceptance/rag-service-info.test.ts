/**
 * RAG v1 integration tests — knowledge retrieval for SERVICE_INFO responses.
 *
 * Verifies that:
 * - knowledge documents enrich service info responses
 * - clinic-specific documents override universal ones
 * - system falls back to catalog-only when no knowledge exists
 * - no data leaks across clinics
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";
import { CLINIC_A_ID, CLINIC_B_ID } from "../fixtures/catalog";

describe("RAG — knowledge retrieval for service info", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();

    // Seed universal knowledge for LIMPEZA
    harness.knowledgeRepo.addDocument({
      clinicId: null,
      documentType: "PROCEDURE",
      category: "LIMPEZA",
      title: "O que é a limpeza dental",
      content:
        "A limpeza dental remove placa bacteriana e tártaro dos dentes. " +
        "O procedimento é indolor e dura de 30 a 45 minutos.",
    });
    harness.knowledgeRepo.addDocument({
      clinicId: null,
      documentType: "FAQ",
      category: "LIMPEZA",
      title: "Perguntas frequentes sobre limpeza",
      content:
        "A limpeza não dói. A frequência recomendada é a cada 6 meses. " +
        "Após o procedimento, é normal sentir os dentes mais lisos.",
    });
  });

  it("includes knowledge content in service info response", async () => {
    const response = await harness.send("como funciona a limpeza?");

    // Should contain knowledge content (placa bacteriana, tártaro, etc.)
    expect(response.reply_text).toContain("placa bacteriana");
    expect(response.reply_text).toContain("Limpeza");
    expect(response.conversation_state).toBe("AUTO");
  });

  it("includes FAQ knowledge when asking about pain", async () => {
    const response = await harness.send("limpeza dói?");

    // FAQ content says "não dói"
    expect(response.reply_text.toLowerCase()).toContain("não dói");
  });

  it("falls back to catalog-only when no knowledge exists for a service", async () => {
    // IMPLANTE has no knowledge seeded in this test
    const response = await harness.send("como funciona o implante?");

    // Should still have basic catalog info (name + duration)
    expect(response.reply_text).toContain("Implante");
    expect(response.conversation_state).toBe("AUTO");
  });
});

describe("RAG — clinic-specific knowledge override", () => {
  it("uses clinic-specific document over universal", async () => {
    const harness = new OrchestratorTestHarness(CLINIC_A_ID);

    // Seed universal knowledge
    harness.knowledgeRepo.addDocument({
      clinicId: null,
      documentType: "PROCEDURE",
      category: "LIMPEZA",
      title: "Limpeza universal",
      content: "A limpeza universal remove tártaro dos dentes.",
    });

    // Seed clinic-specific override
    harness.knowledgeRepo.addDocument({
      clinicId: CLINIC_A_ID,
      documentType: "PROCEDURE",
      category: "LIMPEZA",
      title: "Limpeza na Dentzi Centro",
      content:
        "Na Dentzi Centro, a limpeza inclui avaliação periodontal completa " +
        "e aplicação de flúor.",
    });

    const response = await harness.send("como funciona a limpeza?");

    // Should use clinic-specific content (periodontal, flúor)
    expect(response.reply_text).toContain("periodontal");
  });
});

describe("RAG — tenant isolation", () => {
  it("does NOT leak knowledge from another clinic", async () => {
    const harnessA = new OrchestratorTestHarness(CLINIC_A_ID);
    const harnessB = new OrchestratorTestHarness(CLINIC_B_ID);

    // Seed knowledge ONLY for clinic B
    harnessB.knowledgeRepo.addDocument({
      clinicId: CLINIC_B_ID,
      documentType: "PROCEDURE",
      category: "LIMPEZA",
      title: "Limpeza B",
      content: "Na clínica B, usamos laser ultramoderno para limpeza.",
    });

    // Clinic A should NOT see clinic B's knowledge
    const responseA = await harnessA.send("como funciona a limpeza?");
    expect(responseA.reply_text).not.toContain("laser ultramoderno");
    expect(responseA.reply_text).not.toContain("clínica B");
  });
});

describe("RAG — no knowledge available", () => {
  it("still produces valid response with empty knowledge base", async () => {
    // Fresh harness with NO knowledge seeded
    const harness = new OrchestratorTestHarness();

    const response = await harness.send("como funciona a limpeza?");

    // Should still respond with catalog data
    expect(response.reply_text).toContain("Limpeza");
    expect(response.conversation_state).toBe("AUTO");
    // Should NOT crash or return empty
    expect(response.reply_text.length).toBeGreaterThan(10);
  });
});
