import { buildPatient } from "../../factories/PatientFactory";

describe("Patient domain entity", () => {
  describe("setFullName", () => {
    it("sets full name and transitions LEAD_NEW to LEAD_QUALIFIED", () => {
      const patient = buildPatient({ state: "LEAD_NEW" });
      patient.setFullName("Lucas Silva");
      expect(patient.fullName).toBe("Lucas Silva");
      expect(patient.state).toBe("LEAD_QUALIFIED");
    });

    it("does not transition if already LEAD_QUALIFIED", () => {
      const patient = buildPatient({ state: "LEAD_QUALIFIED", fullName: "Old Name" });
      patient.setFullName("New Name");
      expect(patient.fullName).toBe("New Name");
      expect(patient.state).toBe("LEAD_QUALIFIED");
    });

    it("does not transition if ACTIVE", () => {
      const patient = buildPatient({ state: "ACTIVE", fullName: "Old Name" });
      patient.setFullName("New Name");
      expect(patient.state).toBe("ACTIVE");
    });

    it("trims whitespace from name", () => {
      const patient = buildPatient();
      patient.setFullName("  Lucas Silva  ");
      expect(patient.fullName).toBe("Lucas Silva");
    });

    it("ignores empty string", () => {
      const patient = buildPatient({ fullName: "Lucas" });
      patient.setFullName("   ");
      expect(patient.fullName).toBe("Lucas");
    });
  });

  describe("activate", () => {
    it("transitions to ACTIVE state", () => {
      const patient = buildPatient({ state: "LEAD_QUALIFIED" });
      patient.activate();
      expect(patient.state).toBe("ACTIVE");
    });
  });

  describe("markLeadInactive", () => {
    it("transitions LEAD_NEW to LEAD_INACTIVE", () => {
      const patient = buildPatient({ state: "LEAD_NEW" });
      patient.markLeadInactive();
      expect(patient.state).toBe("LEAD_INACTIVE");
    });

    it("transitions LEAD_QUALIFIED to LEAD_INACTIVE", () => {
      const patient = buildPatient({ state: "LEAD_QUALIFIED" });
      patient.markLeadInactive();
      expect(patient.state).toBe("LEAD_INACTIVE");
    });

    it("does not transition ACTIVE to LEAD_INACTIVE", () => {
      const patient = buildPatient({ state: "ACTIVE" });
      patient.markLeadInactive();
      expect(patient.state).toBe("ACTIVE");
    });
  });

  describe("touchInteraction", () => {
    it("sets lastInteractionAt", () => {
      const patient = buildPatient();
      expect(patient.lastInteractionAt).toBeNull();
      patient.touchInteraction();
      expect(patient.lastInteractionAt).toBeInstanceOf(Date);
    });
  });
});
