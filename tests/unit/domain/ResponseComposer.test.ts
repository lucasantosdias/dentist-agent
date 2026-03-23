import { resolveTemplate, buildServiceListText } from "@/modules/conversations/domain/services/ResponseComposer";
import { buildDefaultClinicSettings } from "@/modules/clinic/domain/ClinicSettings";

describe("ResponseComposer", () => {
  const settings = buildDefaultClinicSettings("clinic-001", "Dentzi Centro");

  describe("resolveTemplate", () => {
    it("interpolates {clinic_name} in greeting", () => {
      const result = resolveTemplate(settings, "greeting");
      expect(result).toContain("Dentzi Centro");
      expect(result).not.toContain("{clinic_name}");
    });

    it("interpolates custom variables", () => {
      const result = resolveTemplate(settings, "hold_created", {
        slot: "2026-03-21T10:00",
        professional: "Dr. Pedro",
        service: "Limpeza",
        ttl: "10",
      });
      expect(result).toContain("Dr. Pedro");
      expect(result).toContain("Limpeza");
      expect(result).toContain("10");
      expect(result).not.toContain("{professional}");
      expect(result).not.toContain("{service}");
    });

    it("returns template with unresolved vars if vars not provided", () => {
      const result = resolveTemplate(settings, "hold_created");
      expect(result).toContain("{slot}");
      expect(result).toContain("{professional}");
    });
  });

  describe("buildServiceListText", () => {
    it("joins service names with commas", () => {
      const result = buildServiceListText([
        { name: "Limpeza" },
        { name: "Clareamento" },
        { name: "Canal" },
      ]);
      expect(result).toBe("Limpeza, Clareamento, Canal");
    });

    it("returns empty string for empty list", () => {
      expect(buildServiceListText([])).toBe("");
    });
  });
});
