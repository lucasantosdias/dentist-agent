import {
  LLM_INTENTS,
  LLM_STAGES,
  CONVERSATION_STATES,
  PATIENT_STATES,
  CARE_TYPES,
  URGENCY_LEVELS,
  KNOWLEDGE_DOCUMENT_TYPES,
  TONE_OPTIONS,
  TEMPLATE_KEYS,
  TRANSACTIONAL_INTENTS,
  INFORMATIONAL_INTENTS,
} from "@/shared/domain/constants";

describe("Domain constants", () => {
  it("defines all 16 intents", () => {
    expect(LLM_INTENTS).toHaveLength(16);
    expect(LLM_INTENTS).toContain("SERVICE_INFO");
    expect(LLM_INTENTS).toContain("GREETING");
    expect(LLM_INTENTS).toContain("BOOK_APPOINTMENT");
    expect(LLM_INTENTS).toContain("UNKNOWN");
  });

  it("defines all 5 stages", () => {
    expect(LLM_STAGES).toHaveLength(5);
  });

  it("defines all 4 conversation states", () => {
    expect(CONVERSATION_STATES).toHaveLength(4);
    expect(CONVERSATION_STATES).toContain("AUTO");
    expect(CONVERSATION_STATES).toContain("FINALIZADA");
  });

  it("defines all 5 patient states", () => {
    expect(PATIENT_STATES).toHaveLength(5);
  });

  it("transactional and informational intents are disjoint", () => {
    for (const intent of TRANSACTIONAL_INTENTS) {
      expect(INFORMATIONAL_INTENTS.has(intent)).toBe(false);
    }
  });

  it("defines knowledge document types", () => {
    expect(KNOWLEDGE_DOCUMENT_TYPES).toContain("PROCEDURE");
    expect(KNOWLEDGE_DOCUMENT_TYPES).toContain("FAQ");
    expect(KNOWLEDGE_DOCUMENT_TYPES).toContain("PREPARATION");
  });

  it("defines tone options", () => {
    expect(TONE_OPTIONS).toContain("warm_professional");
    expect(TONE_OPTIONS).toContain("formal");
  });

  it("defines template keys matching ClinicSettings", () => {
    expect(TEMPLATE_KEYS).toContain("greeting");
    expect(TEMPLATE_KEYS).toContain("ask_name");
    expect(TEMPLATE_KEYS).toContain("escalate_human");
    expect(TEMPLATE_KEYS).toHaveLength(11);
  });
});
