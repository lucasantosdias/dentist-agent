import {
  detectConversationalSignals,
  buildAcknowledgmentPrefix,
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

describe("buildAcknowledgmentPrefix", () => {
  it("builds greeting + service prefix on first turn", () => {
    const signals = {
      hasGreeting: true,
      greetingReply: "Boa tarde!",
      hasServiceMention: true,
      mentionedServiceName: "Limpeza",
      hasConcern: false,
    };
    const prefix = buildAcknowledgmentPrefix(signals, "BOOK_APPOINTMENT", 1);
    expect(prefix).toBe("Boa tarde! Claro, vou te ajudar com o agendamento.");
  });

  it("builds greeting-only prefix when no service mentioned", () => {
    const signals = {
      hasGreeting: true,
      greetingReply: "Bom dia!",
      hasServiceMention: false,
      mentionedServiceName: null,
      hasConcern: false,
    };
    const prefix = buildAcknowledgmentPrefix(signals, "BOOK_APPOINTMENT", 1);
    expect(prefix).toBe("Bom dia!");
  });

  it("returns null when primary intent is GREETING", () => {
    const signals = {
      hasGreeting: true,
      greetingReply: "Oi!",
      hasServiceMention: false,
      mentionedServiceName: null,
      hasConcern: false,
    };
    const prefix = buildAcknowledgmentPrefix(signals, "GREETING", 1);
    expect(prefix).toBeNull();
  });

  it("returns null after first turn (attempts > 1)", () => {
    const signals = {
      hasGreeting: true,
      greetingReply: "Boa tarde!",
      hasServiceMention: true,
      mentionedServiceName: "Limpeza",
      hasConcern: false,
    };
    const prefix = buildAcknowledgmentPrefix(signals, "BOOK_APPOINTMENT", 2);
    expect(prefix).toBeNull();
  });

  it("returns null when no greeting detected", () => {
    const signals = {
      hasGreeting: false,
      greetingReply: null,
      hasServiceMention: true,
      mentionedServiceName: "Limpeza",
      hasConcern: false,
    };
    const prefix = buildAcknowledgmentPrefix(signals, "BOOK_APPOINTMENT", 1);
    expect(prefix).toBeNull();
  });

  it("builds empathetic prefix for PAIN_OR_URGENT_CASE", () => {
    const signals = {
      hasGreeting: true,
      greetingReply: "Oi!",
      hasServiceMention: false,
      mentionedServiceName: null,
      hasConcern: false,
    };
    const prefix = buildAcknowledgmentPrefix(signals, "PAIN_OR_URGENT_CASE", 1);
    expect(prefix).toBe("Oi! Vou te ajudar com isso agora, fique tranquilo(a).");
  });

  it("returns greeting-only for SERVICE_INFO (handler already names service)", () => {
    const signals = {
      hasGreeting: true,
      greetingReply: "Olá!",
      hasServiceMention: true,
      mentionedServiceName: "Limpeza",
      hasConcern: false,
    };
    const prefix = buildAcknowledgmentPrefix(signals, "SERVICE_INFO", 1);
    expect(prefix).toBe("Olá!");
  });

  it("returns null for TALK_TO_HUMAN (operational response)", () => {
    const signals = {
      hasGreeting: true,
      greetingReply: "Oi!",
      hasServiceMention: false,
      mentionedServiceName: null,
      hasConcern: false,
    };
    const prefix = buildAcknowledgmentPrefix(signals, "TALK_TO_HUMAN", 1);
    expect(prefix).toBeNull();
  });
});
