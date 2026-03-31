import { Patient } from "@/modules/patients/domain/Patient";
import { resolveCanonicalPatient } from "@/modules/patients/domain/PatientIdentityResolver";

function makePatient(overrides: Partial<import("@/modules/patients/domain/Patient").PatientProps> = {}): Patient {
  return new Patient({
    id: `patient-${Math.random().toString(36).slice(2, 8)}`,
    clinicId: "clinic-1",
    externalUserId: `ext-${Math.random().toString(36).slice(2, 8)}`,
    defaultChannel: "sim",
    fullName: "Maria Silva",
    cpf: "12345678900",
    phoneE164: null,
    birthDate: null,
    state: "LEAD_NEW",
    lastInteractionAt: null,
    ...overrides,
  });
}

describe("PatientIdentityResolver", () => {
  describe("resolveCanonicalPatient", () => {
    it("returns null for empty list", () => {
      expect(resolveCanonicalPatient([])).toBeNull();
    });

    it("returns the single patient when only one exists", () => {
      const patient = makePatient({ id: "p-1" });
      const result = resolveCanonicalPatient([patient]);

      expect(result).toEqual({
        canonicalPatientId: "p-1",
        allPatientIds: ["p-1"],
      });
    });

    it("prefers ACTIVE over LEAD_NEW", () => {
      const lead = makePatient({ id: "p-lead", state: "LEAD_NEW" });
      const active = makePatient({ id: "p-active", state: "ACTIVE" });

      const result = resolveCanonicalPatient([lead, active]);

      expect(result!.canonicalPatientId).toBe("p-active");
      expect(result!.allPatientIds).toContain("p-lead");
      expect(result!.allPatientIds).toContain("p-active");
    });

    it("prefers ACTIVE over LEAD_QUALIFIED", () => {
      const qualified = makePatient({ id: "p-qualified", state: "LEAD_QUALIFIED" });
      const active = makePatient({ id: "p-active", state: "ACTIVE" });

      const result = resolveCanonicalPatient([qualified, active]);
      expect(result!.canonicalPatientId).toBe("p-active");
    });

    it("prefers LEAD_QUALIFIED over LEAD_NEW", () => {
      const lead = makePatient({ id: "p-new", state: "LEAD_NEW" });
      const qualified = makePatient({ id: "p-qualified", state: "LEAD_QUALIFIED" });

      const result = resolveCanonicalPatient([lead, qualified]);
      expect(result!.canonicalPatientId).toBe("p-qualified");
    });

    it("breaks tie by most recent interaction", () => {
      const older = makePatient({
        id: "p-old",
        state: "ACTIVE",
        lastInteractionAt: new Date("2026-03-01"),
      });
      const newer = makePatient({
        id: "p-new",
        state: "ACTIVE",
        lastInteractionAt: new Date("2026-03-25"),
      });

      const result = resolveCanonicalPatient([older, newer]);
      expect(result!.canonicalPatientId).toBe("p-new");
    });

    it("returns all patient IDs in the result", () => {
      const p1 = makePatient({ id: "p-1", state: "LEAD_NEW" });
      const p2 = makePatient({ id: "p-2", state: "ACTIVE" });
      const p3 = makePatient({ id: "p-3", state: "LEAD_QUALIFIED" });

      const result = resolveCanonicalPatient([p1, p2, p3]);
      expect(result!.allPatientIds).toHaveLength(3);
      expect(result!.allPatientIds).toContain("p-1");
      expect(result!.allPatientIds).toContain("p-2");
      expect(result!.allPatientIds).toContain("p-3");
    });

    it("handles patients with null lastInteractionAt", () => {
      const withInteraction = makePatient({
        id: "p-with",
        state: "LEAD_NEW",
        lastInteractionAt: new Date("2026-03-25"),
      });
      const withoutInteraction = makePatient({
        id: "p-without",
        state: "LEAD_NEW",
        lastInteractionAt: null,
      });

      const result = resolveCanonicalPatient([withoutInteraction, withInteraction]);
      expect(result!.canonicalPatientId).toBe("p-with");
    });
  });
});
