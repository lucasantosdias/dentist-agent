import { MockLlmInterpreter } from "@/modules/ai/infrastructure/MockLlmInterpreter";
import type { LlmInterpretationInput } from "@/modules/ai/application/dto/LlmInterpretation";

function makeInput(text: string, overrides: Partial<LlmInterpretationInput> = {}): LlmInterpretationInput {
  return {
    user_text: text,
    now_iso: "2026-03-20T10:00:00-03:00",
    timezone: "America/Sao_Paulo",
    patient_state: "LEAD_NEW",
    conversation_state: "AUTO",
    current_intent: null,
    collected_data: {},
    known_data: { patient_name: null },
    catalog: {
      services: [
        { service_code: "LIMPEZA", name: "Limpeza", duration_min: 30 },
        { service_code: "CLAREAMENTO", name: "Clareamento", duration_min: 60 },
      ],
      professionals: [
        { name: "Dr. João" },
        { name: "Dra. Marina" },
      ],
    },
    recent_messages: [],
    ...overrides,
  };
}

describe("MockLlmInterpreter — intent classification", () => {
  const interpreter = new MockLlmInterpreter();

  it.each([
    ["Quero marcar consulta", "BOOK_APPOINTMENT"],
    ["Gostaria de agendar uma consulta", "BOOK_APPOINTMENT"],
    ["Preciso marcar dentista", "BOOK_APPOINTMENT"],
    ["Quero fazer uma limpeza", "BOOK_APPOINTMENT"],
    ["Oi", "GREETING"],
    ["Bom dia", "GREETING"],
    ["Boa tarde", "GREETING"],
    ["Quero cancelar minha consulta", "CANCEL_APPOINTMENT"],
    ["Quero falar com atendente", "TALK_TO_HUMAN"],
    ["Estou com dor de dente", "PAIN_OR_URGENT_CASE"],
    ["É urgente", "PAIN_OR_URGENT_CASE"],
    ["Quais serviços vocês oferecem?", "LIST_SERVICES"],
    ["Vocês aceitam convênio?", "INSURANCE_INFO"],
    ["Qual horário de funcionamento?", "HOURS_INFO"],
    ["Onde fica a clínica?", "LOCATION_INFO"],
  ] as const)("classifies \"%s\" as %s", async (text, expectedIntent) => {
    const result = await interpreter.interpret(makeInput(text));
    expect(result.intent).toBe(expectedIntent);
  });

  it("classifies ambiguous messages as UNKNOWN", async () => {
    const result = await interpreter.interpret(makeInput("??"));
    expect(result.intent).toBe("UNKNOWN");
  });
});

describe("MockLlmInterpreter — entity extraction", () => {
  const interpreter = new MockLlmInterpreter();

  it("extracts patient name from 'Meu nome é Lucas'", async () => {
    const result = await interpreter.interpret(makeInput("Meu nome é Lucas"));
    expect(result.entities.full_name).toBe("Lucas");
  });

  it("extracts patient name from 'Me chamo Ana Silva'", async () => {
    const result = await interpreter.interpret(makeInput("Me chamo Ana Silva"));
    expect(result.entities.full_name).toBe("Ana Silva");
  });

  it("extracts service code from 'quero fazer uma limpeza'", async () => {
    const result = await interpreter.interpret(makeInput("Quero fazer uma limpeza"));
    expect(result.entities.service_code).toBe("LIMPEZA");
  });

  it("extracts professional name from 'quero marcar com o Dr. João'", async () => {
    const result = await interpreter.interpret(makeInput("Quero marcar com o Dr. João"));
    expect(result.entities.professional_name).toBe("Dr. João");
  });

  it("extracts care_type PARTICULAR", async () => {
    const result = await interpreter.interpret(makeInput("É particular"));
    expect(result.entities.care_type).toBe("PARTICULAR");
  });

  it("extracts care_type INSURANCE from 'convênio'", async () => {
    const result = await interpreter.interpret(makeInput("É por convênio"));
    expect(result.entities.care_type).toBe("INSURANCE");
  });

  it("extracts datetime from 'amanhã às 10h'", async () => {
    const result = await interpreter.interpret(makeInput("Amanhã às 10h"));
    expect(result.entities.datetime_iso).toBeTruthy();
    expect(result.entities.datetime_iso).toContain("10:00");
  });

  it("extracts urgency from pain-related messages", async () => {
    const result = await interpreter.interpret(makeInput("Estou com dor de dente"));
    expect(result.entities.urgency_level).toBe("ALTA");
    expect(result.entities.symptom).toBe("dor de dente");
  });

  it("uses known patient name when no name in text", async () => {
    const result = await interpreter.interpret(
      makeInput("Quero marcar consulta", {
        known_data: { patient_name: "Maria" },
      }),
    );
    expect(result.entities.full_name).toBe("Maria");
  });
});
