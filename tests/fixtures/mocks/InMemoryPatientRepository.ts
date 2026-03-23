import type { PatientRepositoryPort } from "@/modules/patients/application/ports/PatientRepositoryPort";
import { Patient } from "@/modules/patients/domain/Patient";
import { randomUUID } from "crypto";

export class InMemoryPatientRepository implements PatientRepositoryPort {
  private patients: Map<string, Patient> = new Map();

  async findByChannelAndExternalUser(
    clinicId: string,
    channel: string,
    externalUserId: string,
  ): Promise<Patient | null> {
    for (const patient of this.patients.values()) {
      const p = patient.toPrimitives();
      if (
        p.clinicId === clinicId &&
        p.defaultChannel === channel &&
        p.externalUserId === externalUserId
      ) {
        return patient;
      }
    }
    return null;
  }

  async create(clinicId: string, channel: string, externalUserId: string): Promise<Patient> {
    const patient = new Patient({
      id: randomUUID(),
      clinicId,
      externalUserId,
      defaultChannel: channel,
      fullName: null,
      phoneE164: null,
      state: "LEAD_NEW",
      lastInteractionAt: null,
    });
    this.patients.set(patient.id, patient);
    return patient;
  }

  async save(patient: Patient): Promise<Patient> {
    this.patients.set(patient.id, patient);
    return patient;
  }

  async findById(id: string): Promise<Patient | null> {
    return this.patients.get(id) ?? null;
  }

  /** Test helper: seed a patient directly */
  seed(patient: Patient): void {
    this.patients.set(patient.id, patient);
  }

  /** Test helper: get all patients */
  getAll(): Patient[] {
    return Array.from(this.patients.values());
  }

  /** Test helper: clear all */
  clear(): void {
    this.patients.clear();
  }
}
