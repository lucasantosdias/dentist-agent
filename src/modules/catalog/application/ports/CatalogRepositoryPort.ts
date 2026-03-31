import type { Professional } from "@/modules/catalog/domain/Professional";
import type { Service } from "@/modules/catalog/domain/Service";

export type CreateProfessionalInput = {
  displayName: string;
  specialtyIds?: string[];
  email?: string | null;
  phone?: string | null;
  timezone?: string;
};

export type CreateServiceInput = {
  code: string;
  displayName: string;
  durationMinutes: number;
  description?: string;
  price?: number;
};

export interface CatalogRepositoryPort {
  /* ── Service (clinic-scoped) ─────────────────────────────── */
  findServiceByCode(clinicId: string, code: string): Promise<Service | null>;
  findServiceById(serviceId: string): Promise<Service | null>;
  listActiveServices(clinicId: string): Promise<Service[]>;
  createService(clinicId: string, input: CreateServiceInput): Promise<Service>;

  /* ── Professional (clinic-scoped queries, global entity) ── */
  findProfessionalByName(clinicId: string, name: string): Promise<Professional | null>;
  findProfessionalById(professionalId: string): Promise<Professional | null>;
  listActiveProfessionals(clinicId: string): Promise<Professional[]>;
  listActiveProfessionalsForService(clinicId: string, serviceId: string): Promise<Professional[]>;

  /* ── Professional (global operations) ─────────────────────  */
  professionalCanExecuteService(professionalId: string, serviceId: string): Promise<boolean>;
  createProfessional(input: CreateProfessionalInput): Promise<Professional>;
  addProfessionalService(professionalId: string, serviceId: string): Promise<void>;
}
