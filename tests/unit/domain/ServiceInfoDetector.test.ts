import { detectServiceInfoIntent } from "@/modules/conversations/domain/services/ServiceInfoDetector";

const catalog = {
  services: [
    { service_code: "LIMPEZA", name: "Limpeza", duration_min: 30 },
    { service_code: "CLAREAMENTO", name: "Clareamento", duration_min: 60 },
    { service_code: "CANAL", name: "Canal", duration_min: 90 },
    { service_code: "IMPLANTE", name: "Implante", duration_min: 120 },
    { service_code: "AVALIACAO", name: "Avaliação", duration_min: 20 },
  ],
};

describe("ServiceInfoDetector", () => {
  describe("positive detection — interrogative + service reference", () => {
    it.each([
      ["como funciona a limpeza?", "LIMPEZA"],
      ["o que é clareamento?", "CLAREAMENTO"],
      ["como funciona implante?", "IMPLANTE"],
      ["tratamento de canal dói?", "CANAL"],
      ["pra que serve avaliação?", "AVALIACAO"],
      ["como é feita a limpeza?", "LIMPEZA"],
      ["me explica sobre o canal", "CANAL"],
      ["quero saber sobre limpeza", "LIMPEZA"],
      ["informações sobre clareamento", "CLAREAMENTO"],
    ])("detects '%s' as service info (code=%s)", (text, expectedCode) => {
      const result = detectServiceInfoIntent(text, catalog);
      expect(result).not.toBeNull();
      expect(result!.serviceCode).toBe(expectedCode);
    });
  });

  describe("positive detection — generic procedural terms", () => {
    it.each([
      "como é esse procedimento?",
      "esse procedimento é dolorido?",
      "como funciona o tratamento?",
    ])("detects '%s' as service info (no specific code)", (text) => {
      const result = detectServiceInfoIntent(text, catalog);
      expect(result).not.toBeNull();
      // No specific service matched, but it's still a service info query
    });
  });

  describe("negative detection — NOT service info", () => {
    it.each([
      "Bom dia",
      "Oi",
      "Quero marcar consulta",
      "Quero cancelar minha consulta",
      "estou com dor de dente",
      "??",
      "sei lá",
      "hmm",
      "limpeza",  // Just the word, no interrogative
      "quero fazer uma limpeza",  // Booking intent, not info
    ])("does NOT detect '%s' as service info", (text) => {
      const result = detectServiceInfoIntent(text, catalog);
      expect(result).toBeNull();
    });
  });

  describe("accent handling", () => {
    it("matches 'avaliação' with normalized catalog", () => {
      const result = detectServiceInfoIntent("como funciona a avaliação?", catalog);
      expect(result).not.toBeNull();
      expect(result!.serviceCode).toBe("AVALIACAO");
    });
  });
});
