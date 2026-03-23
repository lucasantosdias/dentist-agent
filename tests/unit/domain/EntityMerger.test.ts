import { mergeEntitiesIntoCollectedData } from "@/modules/conversations/domain/services/EntityMerger";
import type { LlmEntities } from "@/modules/ai/application/dto/LlmInterpretation";

describe("EntityMerger", () => {
  it("merges new entities into empty collected data", () => {
    const result = mergeEntitiesIntoCollectedData({}, {
      full_name: "Lucas",
      care_type: "PARTICULAR",
    });
    expect(result.full_name).toBe("Lucas");
    expect(result.care_type).toBe("PARTICULAR");
  });

  it("preserves existing values when new entities are null", () => {
    const result = mergeEntitiesIntoCollectedData(
      { full_name: "Lucas", care_type: "PARTICULAR" },
      { full_name: null, care_type: null },
    );
    expect(result.full_name).toBe("Lucas");
    expect(result.care_type).toBe("PARTICULAR");
  });

  it("overwrites existing values with non-null new values", () => {
    const result = mergeEntitiesIntoCollectedData(
      { full_name: "Lucas" },
      { full_name: "Pedro" },
    );
    expect(result.full_name).toBe("Pedro");
  });

  it("does not merge empty string values", () => {
    const result = mergeEntitiesIntoCollectedData(
      { full_name: "Lucas" },
      { full_name: "" },
    );
    expect(result.full_name).toBe("Lucas");
  });

  it("merges all supported entity fields", () => {
    const entities: LlmEntities = {
      full_name: "Lucas",
      phone_number: "+5511999999999",
      care_type: "PARTICULAR",
      insurance_name: null,
      service_code: "LIMPEZA",
      primary_reason: null,
      symptom: null,
      professional_name: "Dr. João",
      preferred_date: "2026-03-21",
      preferred_time: "10:00",
      datetime_iso: "2026-03-21T10:00:00-03:00",
      appointment_id: null,
      urgency_level: null,
    };

    const result = mergeEntitiesIntoCollectedData({}, entities);
    expect(result.full_name).toBe("Lucas");
    expect(result.service_code).toBe("LIMPEZA");
    expect(result.professional_name).toBe("Dr. João");
    expect(result.datetime_iso).toBe("2026-03-21T10:00:00-03:00");
  });

  it("accumulates data across multiple merges (progressive collection)", () => {
    let data = mergeEntitiesIntoCollectedData({}, { full_name: "Lucas" });
    data = mergeEntitiesIntoCollectedData(data, { care_type: "PARTICULAR" });
    data = mergeEntitiesIntoCollectedData(data, { service_code: "LIMPEZA" });
    data = mergeEntitiesIntoCollectedData(data, { datetime_iso: "2026-03-21T10:00:00-03:00" });

    expect(data.full_name).toBe("Lucas");
    expect(data.care_type).toBe("PARTICULAR");
    expect(data.service_code).toBe("LIMPEZA");
    expect(data.datetime_iso).toBe("2026-03-21T10:00:00-03:00");
  });
});
