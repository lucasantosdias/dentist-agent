import type { Clinic } from "@/modules/clinic/domain/Clinic";

export type CreateClinicInput = {
  name: string;
  legalName?: string | null;
  document?: string | null;
  slug: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  timezone?: string;
};

export interface ClinicRepositoryPort {
  findById(id: string): Promise<Clinic | null>;
  findBySlug(slug: string): Promise<Clinic | null>;
  listActive(): Promise<Clinic[]>;
  create(input: CreateClinicInput): Promise<Clinic>;
  save(clinic: Clinic): Promise<Clinic>;
  addProfessional(clinicId: string, professionalId: string, role?: string): Promise<void>;
  removeProfessional(clinicId: string, professionalId: string): Promise<void>;
  listProfessionalIds(clinicId: string): Promise<string[]>;
}
