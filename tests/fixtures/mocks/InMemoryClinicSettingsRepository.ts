import type { ClinicSettingsPort } from "@/modules/clinic/application/ports/ClinicSettingsPort";
import { ClinicSettings, buildDefaultClinicSettings } from "@/modules/clinic/domain/ClinicSettings";

export class InMemoryClinicSettingsRepository implements ClinicSettingsPort {
  private settings: Map<string, ClinicSettings> = new Map();

  async findByClinicId(clinicId: string): Promise<ClinicSettings | null> {
    return this.settings.get(clinicId) ?? buildDefaultClinicSettings(clinicId, "Dentzi Test");
  }

  /** Test helper: set custom settings for a clinic */
  setSettings(clinicId: string, settings: ClinicSettings): void {
    this.settings.set(clinicId, settings);
  }

  clear(): void {
    this.settings.clear();
  }
}
