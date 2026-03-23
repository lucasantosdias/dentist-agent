import { ClinicSettings, buildDefaultClinicSettings } from "@/modules/clinic/domain/ClinicSettings";

describe("ClinicSettings", () => {
  it("builds default settings with correct defaults", () => {
    const settings = buildDefaultClinicSettings("clinic-001", "Dentzi Centro");

    expect(settings.clinicDisplayName).toBe("Dentzi Centro");
    expect(settings.botName).toBe("secretária");
    expect(settings.tone).toBe("warm_professional");
    expect(settings.workingHourStart).toBe(8);
    expect(settings.workingHourEnd).toBe(19);
    expect(settings.maxUnknownBeforeFallback).toBe(3);
    expect(settings.holdTtlMinutes).toBe(10);
  });

  it("generates working hours text from start/end", () => {
    const settings = buildDefaultClinicSettings("clinic-001", "Test");
    expect(settings.workingHoursText).toBe("08:00-19:00");
  });

  it("resolves template by key (fallback templates)", () => {
    const settings = buildDefaultClinicSettings("clinic-001", "Test");
    // Fallback templates are minimal but present
    expect(settings.getTemplate("ask_name")).toContain("nome");
    expect(settings.getTemplate("escalate_human")).toContain("atendente");
    expect(settings.getTemplate("greeting")).toContain("{clinic_name}");
  });

  it("resolves all template keys without error", () => {
    const settings = buildDefaultClinicSettings("clinic-001", "Test");
    const keys = [
      "ask_name", "ask_care_type", "ask_service", "ask_datetime",
      "ask_professional", "hold_created", "appointment_confirmed",
      "no_slots", "escalate_human", "greeting", "fallback",
    ] as const;

    for (const key of keys) {
      expect(settings.getTemplate(key)).toBeTruthy();
    }
  });
});
