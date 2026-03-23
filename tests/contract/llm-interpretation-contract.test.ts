/**
 * Contract test — LLM Interpretation output contract
 *
 * Ensures the MockLlmInterpreter returns data conforming to
 * the LlmInterpretation interface for all message types.
 */
import { MockLlmInterpreter } from "@/modules/ai/infrastructure/MockLlmInterpreter";
import type { LlmInterpretationInput, LlmIntent, LlmStage } from "@/modules/ai/application/dto/LlmInterpretation";
import { llmIntents, llmStages } from "@/modules/ai/application/dto/LlmInterpretation";

const validIntents = new Set<string>(llmIntents);
const validStages = new Set<string>(llmStages);

function makeInput(text: string): LlmInterpretationInput {
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
      ],
      professionals: [{ name: "Dr. João" }],
    },
    recent_messages: [],
  };
}

describe("LLM Interpretation contract", () => {
  const interpreter = new MockLlmInterpreter();

  const testMessages = [
    "Quero marcar consulta",
    "Meu nome é Lucas",
    "Bom dia",
    "??",
    "Quero cancelar",
    "Quero falar com atendente",
    "Estou com dor",
    "Quero fazer uma limpeza",
    "Amanhã às 10h",
    "É particular",
  ];

  it.each(testMessages)("returns valid contract for '%s'", async (text) => {
    const result = await interpreter.interpret(makeInput(text));

    // Required fields must exist
    expect(result).toHaveProperty("intent");
    expect(result).toHaveProperty("stage");
    expect(result).toHaveProperty("entities");
    expect(result).toHaveProperty("missing");

    // intent must be valid
    expect(validIntents.has(result.intent)).toBe(true);

    // stage must be valid
    expect(validStages.has(result.stage)).toBe(true);

    // entities must be an object
    expect(typeof result.entities).toBe("object");

    // missing must be an array
    expect(Array.isArray(result.missing)).toBe(true);

    // user_accepts_slot must be boolean or null/undefined
    if (result.user_accepts_slot !== undefined && result.user_accepts_slot !== null) {
      expect(typeof result.user_accepts_slot).toBe("boolean");
    }

    // suggested_next_question must be string or null/undefined
    if (result.suggested_next_question !== undefined && result.suggested_next_question !== null) {
      expect(typeof result.suggested_next_question).toBe("string");
    }
  });

  it("entities object has expected shape", async () => {
    const result = await interpreter.interpret(makeInput("Meu nome é Lucas"));

    // Check that all known entity keys are present (even if null)
    const entityKeys = [
      "full_name", "service_code", "professional_name",
      "datetime_iso", "care_type", "urgency_level",
      "primary_reason", "symptom",
    ];

    for (const key of entityKeys) {
      expect(result.entities).toHaveProperty(key);
    }
  });
});
