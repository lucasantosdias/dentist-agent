import type { Patient } from "@/modules/patients/domain/Patient";

export interface PatientRepositoryPort {
  findByChannelAndExternalUser(clinicId: string, channel: string, externalUserId: string): Promise<Patient | null>;
  create(clinicId: string, channel: string, externalUserId: string): Promise<Patient>;
  save(patient: Patient): Promise<Patient>;
  findById(id: string): Promise<Patient | null>;
  /** Find patients in a clinic by name or CPF. Used for cross-session identity matching. */
  findByClinicAndIdentity(clinicId: string, name?: string | null, cpf?: string | null): Promise<Patient[]>;
  /** Find all patients with a given CPF within a clinic. Used for identity resolution. */
  findByCpfAndClinic(clinicId: string, cpf: string): Promise<Patient[]>;
}
