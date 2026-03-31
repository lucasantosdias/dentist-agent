import { getFieldPriority, buildFunnelStep } from "@/modules/conversations/domain/services/NextQuestionBuilder";

describe("NextQuestionBuilder", () => {
  describe("getFieldPriority", () => {
    it("prioritizes service_code when service is unknown", () => {
      const priority = getFieldPriority("BOOK_APPOINTMENT", [
        "full_name", "care_type", "service_code", "datetime_iso",
      ]);
      expect(priority[0]).toBe("service_code");
    });

    it("prioritizes full_name when service is known", () => {
      const priority = getFieldPriority("BOOK_APPOINTMENT", [
        "full_name", "care_type", "datetime_iso",
      ]);
      expect(priority[0]).toBe("full_name");
    });

    it("returns correct order for RESCHEDULE_APPOINTMENT", () => {
      const priority = getFieldPriority("RESCHEDULE_APPOINTMENT", [
        "full_name", "appointment_id", "datetime_iso",
      ]);
      expect(priority).toEqual(["full_name", "appointment_id", "datetime_iso"]);
    });

    it("returns correct order for CANCEL_APPOINTMENT", () => {
      const priority = getFieldPriority("CANCEL_APPOINTMENT", [
        "full_name", "appointment_id",
      ]);
      expect(priority).toEqual(["full_name", "appointment_id"]);
    });

    it("returns correct order for PAIN_OR_URGENT_CASE", () => {
      const priority = getFieldPriority("PAIN_OR_URGENT_CASE", [
        "full_name", "symptom",
      ]);
      expect(priority).toEqual(["full_name", "symptom"]);
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
