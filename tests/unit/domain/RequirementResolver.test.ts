import {
  resolveMissingRequirements,
  resolveMissingForBooking,
  isIntentTransactional,
  isIntentInformational,
  hasServiceOrReason,
  getRequiredFields,
} from "@/modules/conversations/domain/services/RequirementResolver";
import type { LlmIntent } from "@/modules/ai/application/dto/LlmInterpretation";

describe("RequirementResolver", () => {
  describe("resolveMissingForBooking", () => {
    it("returns all required fields when collected data is empty", () => {
      const missing = resolveMissingForBooking({});
      expect(missing).toEqual(["full_name", "cpf", "care_type", "service_code", "datetime_iso"]);
    });

    it("returns remaining fields when some data is collected", () => {
      const missing = resolveMissingForBooking({
        full_name: "Lucas",
        cpf: "12345678900",
        care_type: "PARTICULAR",
      });
      expect(missing).toEqual(["service_code", "datetime_iso"]);
    });

    it("returns empty when all required fields are present", () => {
      const missing = resolveMissingForBooking({
        full_name: "Lucas",
        cpf: "12345678900",
        care_type: "PARTICULAR",
        service_code: "LIMPEZA",
        datetime_iso: "2026-03-21T10:00:00-03:00",
      });
      expect(missing).toEqual([]);
    });

    it("accepts primary_reason as alternative to service_code", () => {
      const missing = resolveMissingForBooking({
        full_name: "Lucas",
        cpf: "12345678900",
        care_type: "PARTICULAR",
        primary_reason: "dor de dente",
        datetime_iso: "2026-03-21T10:00:00-03:00",
      });
      expect(missing).toEqual([]);
    });

    it("treats null and empty string as missing", () => {
      const missing = resolveMissingForBooking({
        full_name: null,
        care_type: "",
      });
      expect(missing).toContain("full_name");
      expect(missing).toContain("care_type");
    });
  });

  describe("resolveMissingRequirements", () => {
    it("resolves missing fields for CANCEL_APPOINTMENT", () => {
      const missing = resolveMissingRequirements("CANCEL_APPOINTMENT", {});
      expect(missing).toEqual(["full_name", "appointment_id"]);
    });

    it("returns empty for intent with no requirements", () => {
      const missing = resolveMissingRequirements("GREETING", {});
      expect(missing).toEqual([]);
    });

    it("resolves for CHECK_AVAILABILITY with no required fields", () => {
      const missing = resolveMissingRequirements("CHECK_AVAILABILITY", {});
      expect(missing).toEqual([]);
    });
  });

  describe("isIntentTransactional", () => {
    it.each([
      "BOOK_APPOINTMENT",
      "RESCHEDULE_APPOINTMENT",
      "CANCEL_APPOINTMENT",
      "CONFIRM_APPOINTMENT",
      "CHECK_AVAILABILITY",
      "PAIN_OR_URGENT_CASE",
    ] as LlmIntent[])("returns true for %s", (intent) => {
      expect(isIntentTransactional(intent)).toBe(true);
    });

    it.each([
      "GREETING",
      "LIST_SERVICES",
      "CLINIC_INFO",
      "UNKNOWN",
    ] as LlmIntent[])("returns false for %s", (intent) => {
      expect(isIntentTransactional(intent)).toBe(false);
    });
  });

  describe("isIntentInformational", () => {
    it.each([
      "GREETING",
      "LIST_SERVICES",
      "CLINIC_INFO",
      "INSURANCE_INFO",
      "HOURS_INFO",
      "LOCATION_INFO",
    ] as LlmIntent[])("returns true for %s", (intent) => {
      expect(isIntentInformational(intent)).toBe(true);
    });

    it("returns false for BOOK_APPOINTMENT", () => {
      expect(isIntentInformational("BOOK_APPOINTMENT")).toBe(false);
    });

    it("returns false for UNKNOWN", () => {
      expect(isIntentInformational("UNKNOWN")).toBe(false);
    });
  });

  describe("hasServiceOrReason", () => {
    it("returns true when service_code is set", () => {
      expect(hasServiceOrReason({ service_code: "LIMPEZA" })).toBe(true);
    });

    it("returns true when primary_reason is set", () => {
      expect(hasServiceOrReason({ primary_reason: "dor de dente" })).toBe(true);
    });

    it("returns false when neither is set", () => {
      expect(hasServiceOrReason({})).toBe(false);
    });
  });

  describe("getRequiredFields", () => {
    it("returns required fields for BOOK_APPOINTMENT", () => {
      expect(getRequiredFields("BOOK_APPOINTMENT")).toEqual(["full_name", "care_type", "datetime_iso"]);
    });

    it("returns empty for UNKNOWN", () => {
      expect(getRequiredFields("UNKNOWN")).toEqual([]);
    });
  });
});
