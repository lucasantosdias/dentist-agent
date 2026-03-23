/**
 * PT-BR message variations — Robustness tests
 *
 * Ensures the system handles natural Brazilian Portuguese variations correctly.
 */
import { OrchestratorTestHarness } from "../fixtures/OrchestratorTestHarness";

describe("PT-BR message variations", () => {
  let harness: OrchestratorTestHarness;

  beforeEach(() => {
    harness = new OrchestratorTestHarness();
  });

  describe("booking intent variations", () => {
    it.each([
      "Quero marcar consulta",
      "Gostaria de agendar uma consulta",
      "Preciso marcar dentista",
      "Quero fazer uma limpeza",
      "Quero limpar os dentes",
    ])("classifies '%s' as BOOK_APPOINTMENT", async (text) => {
      await harness.send(text);
      const conv = await harness.getLatestConversation();
      expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
    });
  });

  describe("availability check variations", () => {
    it("handles 'Qual a disponibilidade amanhã?'", async () => {
      const response = await harness.send("Qual a disponibilidade amanhã?");
      // Mock classifier matches "disponib" in "disponibilidade" → CHECK_AVAILABILITY
      const conv = await harness.getLatestConversation();
      expect(conv!.currentIntent).toBe("CHECK_AVAILABILITY");
      expect(response.reply_text).toBeTruthy();
    });
  });

  describe("urgency variations", () => {
    it("handles 'É urgente' as PAIN_OR_URGENT_CASE", async () => {
      await harness.send("É urgente");
      const conv = await harness.getLatestConversation();
      expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
    });

    it("handles 'Estou com dor' as urgent", async () => {
      await harness.send("Estou com dor");
      const conv = await harness.getLatestConversation();
      expect(conv!.currentIntent).toBe("PAIN_OR_URGENT_CASE");
    });
  });

  describe("time preferences", () => {
    it("handles 'Pode ser de manhã?' within booking flow", async () => {
      // Start booking first
      await harness.send("Quero marcar consulta");
      await harness.send("Meu nome é Lucas");
      const response = await harness.send("Pode ser de manhã?");

      // Should maintain booking intent
      const conv = await harness.getLatestConversation();
      expect(conv!.currentIntent).toBe("BOOK_APPOINTMENT");
      expect(response.conversation_state).toBe("AUTO");
    });
  });

  describe("greeting variations", () => {
    it.each([
      "Oi",
      "Bom dia",
      "Boa tarde",
      "Boa noite",
      "Olá",
    ])("handles greeting '%s'", async (text) => {
      const response = await harness.send(text);
      expect(response.reply_text).toBeTruthy();
      expect(response.conversation_state).toBe("AUTO");
    });
  });

  describe("service-specific requests", () => {
    it("extracts LIMPEZA service from 'Quero fazer uma limpeza'", async () => {
      await harness.send("Quero fazer uma limpeza");

      const conv = await harness.getLatestConversation();
      expect(conv!.collectedData.service_code).toBe("LIMPEZA");
    });

    it("extracts CLAREAMENTO service from 'Quero fazer clareamento'", async () => {
      await harness.send("Quero fazer clareamento");

      const conv = await harness.getLatestConversation();
      expect(conv!.collectedData.service_code).toBe("CLAREAMENTO");
    });
  });

  describe("human escalation", () => {
    it("handles 'Quero falar com atendente'", async () => {
      const response = await harness.send("Quero falar com atendente");
      expect(response.conversation_state).toBe("HUMAN");
      expect(response.reply_text).toContain("atendente");
    });
  });
});
