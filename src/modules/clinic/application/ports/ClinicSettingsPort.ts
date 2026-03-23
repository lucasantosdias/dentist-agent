import type { ClinicSettings } from "@/modules/clinic/domain/ClinicSettings";

export interface ClinicSettingsPort {
  findByClinicId(clinicId: string): Promise<ClinicSettings | null>;
}
