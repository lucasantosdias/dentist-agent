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
      cpf: null,
      phoneE164: null,
      birthDate: null,
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

  async findByCpfAndClinic(clinicId: string, cpf: string): Promise<Patient[]> {
    const results: Patient[] = [];
    for (const patient of this.patients.values()) {
      if (patient.clinicId === clinicId && patient.cpf === cpf) {
        results.push(patient);
      }
    }
    return results;
  }

  async findByClinicAndIdentity(clinicId: string, name?: string | null, cpf?: string | null): Promise<Patient[]> {
    if (!name && !cpf) return [];
    const results: Patient[] = [];
    for (const patient of this.patients.values()) {
      if (patient.clinicId !== clinicId) continue;
      if (cpf && patient.cpf === cpf) { results.push(patient); continue; }
      if (name && patient.fullName?.toLowerCase() === name.toLowerCase()) { results.push(patient); }
    }
    return results;
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
