import {
  detectConversationalSignals,
} from "@/modules/conversations/domain/services/ConversationalSignals";

const catalog = [
  { service_code: "LIMPEZA", name: "Limpeza" },
  { service_code: "CLAREAMENTO", name: "Clareamento" },
  { service_code: "CANAL", name: "Canal" },
  { service_code: "IMPLANTE", name: "Implante" },
  { service_code: "AVALIACAO", name: "Avaliação" },
];

describe("detectConversationalSignals", () => {
  describe("greeting detection", () => {
    it.each([
      ["boa tarde, quero marcar limpeza", "Boa tarde!"],
      ["bom dia, gostaria de agendar", "Bom dia!"],
      ["boa noite, preciso de ajuda", "Boa noite!"],
      ["olá, como funciona a limpeza?", "Olá!"],
      ["oi, quero marcar consulta", "Oi!"],
    ])("detects greeting in '%s'", (text, expectedReply) => {
      const signals = detectConversationalSignals(text, catalog);
      expect(signals.hasGreeting).toBe(true);
      expect(signals.greetingReply).toBe(expectedReply);
    });

    it("does not detect greeting in plain booking request", () => {
      const signals = detectConversationalSignals("quero marcar consulta", catalog);
      expect(signals.hasGreeting).toBe(false);
      expect(signals.greetingReply).toBeNull();
    });

    it("does not detect greeting in gibberish", () => {
      const signals = detectConversationalSignals("asdfg", catalog);
      expect(signals.hasGreeting).toBe(false);
    });
  });

  describe("service mention detection", () => {
    it.each([
      ["quero fazer uma limpeza", "Limpeza"],
      ["como funciona clareamento?", "Clareamento"],
      ["gostaria de marcar canal", "Canal"],
      ["quero agendar avaliação", "Avaliação"],
    ])("detects service in '%s'", (text, expectedService) => {
      const signals = detectConversationalSignals(text, catalog);
      expect(signals.hasServiceMention).toBe(true);
      expect(signals.mentionedServiceName).toBe(expectedService);
    });

    it("does not detect service in generic message", () => {
      const signals = detectConversationalSignals("quero marcar consulta", catalog);
      expect(signals.hasServiceMention).toBe(false);
    });
  });

  describe("combined signals", () => {
    it("detects both greeting and service in mixed message", () => {
      const signals = detectConversationalSignals(
        "boa tarde, gostaria de fazer uma limpeza",
        catalog,
      );
      expect(signals.hasGreeting).toBe(true);
      expect(signals.greetingReply).toBe("Boa tarde!");
      expect(signals.hasServiceMention).toBe(true);
      expect(signals.mentionedServiceName).toBe("Limpeza");
    });
  });
});
