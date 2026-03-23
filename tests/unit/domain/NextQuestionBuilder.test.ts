import { buildNextQuestion, buildFunnelStep } from "@/modules/conversations/domain/services/NextQuestionBuilder";

describe("NextQuestionBuilder", () => {
  describe("buildNextQuestion", () => {
    it("asks for service first when service is unknown (before name)", () => {
      const question = buildNextQuestion(
        ["full_name", "care_type", "service_code", "professional_name", "datetime_iso"],
        "BOOK_APPOINTMENT",
      );
      // When service is still missing, ask for it first
      expect(question.toLowerCase()).toContain("procedimento");
    });

    it("asks for name first when service is already known", () => {
      const question = buildNextQuestion(
        ["full_name", "care_type", "professional_name", "datetime_iso"],
        "BOOK_APPOINTMENT",
      );
      expect(question).toContain("nome");
    });

    it("asks for care_type when name is provided but care_type is missing", () => {
      const question = buildNextQuestion(
        ["care_type", "professional_name", "datetime_iso"],
        "BOOK_APPOINTMENT",
      );
      expect(question.toLowerCase()).toContain("particular");
    });

    it("asks for service_code when name and care_type collected", () => {
      const question = buildNextQuestion(
        ["service_code", "datetime_iso"],
        "BOOK_APPOINTMENT",
      );
      expect(question).toContain("procedimento");
    });

    it("asks for datetime when only datetime is missing", () => {
      const question = buildNextQuestion(
        ["datetime_iso"],
        "BOOK_APPOINTMENT",
      );
      expect(question.toLowerCase()).toContain("dia");
    });

    it("returns confirmation prompt when no fields are missing", () => {
      const question = buildNextQuestion([], "BOOK_APPOINTMENT");
      expect(question).toBeTruthy();
    });

    it("uses LLM suggestion as fallback for unknown field", () => {
      const question = buildNextQuestion(
        ["unknown_field"],
        "BOOK_APPOINTMENT",
        "Qual informação você gostaria de fornecer?",
      );
      expect(question).toBeTruthy();
    });
  });

  describe("buildFunnelStep", () => {
    it("returns COLLECTING_DATA when fields are missing", () => {
      expect(buildFunnelStep("BOOK_APPOINTMENT", ["full_name"], false)).toBe("COLLECTING_DATA");
    });

    it("returns AWAITING_CONFIRMATION when no missing and has hold", () => {
      expect(buildFunnelStep("BOOK_APPOINTMENT", [], true)).toBe("AWAITING_CONFIRMATION");
    });

    it("returns AWAITING_SLOT_SELECTION when no missing and no hold", () => {
      expect(buildFunnelStep("BOOK_APPOINTMENT", [], false)).toBe("AWAITING_SLOT_SELECTION");
    });
  });
});
