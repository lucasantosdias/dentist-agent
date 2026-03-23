import type { Patient } from "@/modules/patients/domain/Patient";

export interface PatientRepositoryPort {
  findByChannelAndExternalUser(clinicId: string, channel: string, externalUserId: string): Promise<Patient | null>;
  create(clinicId: string, channel: string, externalUserId: string): Promise<Patient>;
  save(patient: Patient): Promise<Patient>;
  findById(id: string): Promise<Patient | null>;
}
