import type { PrismaClient } from "@prisma/client";

import { Professional } from "@/modules/catalog/domain/Professional";
import { Service } from "@/modules/catalog/domain/Service";
import type {
  CatalogRepositoryPort,
  CreateProfessionalInput,
  CreateServiceInput,
} from "@/modules/catalog/application/ports/CatalogRepositoryPort";

function toService(row: {
  id: string;
  clinicId: string;
  code: string;
  displayName: string;
  description: string | null;
  durationMinutes: number;
  price: unknown;
  active: boolean;
}): Service {
  return new Service({
    id: row.id,
    clinicId: row.clinicId,
    code: row.code,
    displayName: row.displayName,
    description: row.description,
    durationMinutes: row.durationMinutes,
    price: row.price != null ? Number(row.price) : null,
    active: row.active,
  });
}

function toProfessional(row: {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  active: boolean;
}): Professional {
  return new Professional({
    id: row.id,
    displayName: row.displayName,
    email: row.email,
    phone: row.phone,
    timezone: row.timezone,
    active: row.active,
  });
}

export class PrismaCatalogRepository implements CatalogRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  /* ── Service (clinic-scoped) ─────────────────────────────── */

  async findServiceByCode(clinicId: string, code: string): Promise<Service | null> {
    const row = await this.prisma.service.findUnique({
      where: { clinicId_code: { clinicId, code } },
    });
    return row ? toService(row) : null;
  }

  async findServiceById(serviceId: string): Promise<Service | null> {
    const row = await this.prisma.service.findUnique({ where: { id: serviceId } });
    return row ? toService(row) : null;
  }

  async listActiveServices(clinicId: string): Promise<Service[]> {
    const rows = await this.prisma.service.findMany({
      where: { clinicId, active: true },
      orderBy: { displayName: "asc" },
    });
    return rows.map(toService);
  }

  async createService(clinicId: string, input: CreateServiceInput): Promise<Service> {
    const row = await this.prisma.service.create({
      data: {
        clinicId,
        code: input.code,
        displayName: input.displayName,
        durationMinutes: input.durationMinutes,
        description: input.description ?? null,
        price: input.price ?? null,
      },
    });
    return toService(row);
  }

  /* ── Professional (clinic-scoped queries) ────────────────── */

  async findProfessionalByName(clinicId: string, name: string): Promise<Professional | null> {
    const row = await this.prisma.professional.findFirst({
      where: {
        displayName: { equals: name, mode: "insensitive" },
        clinicProfessionals: { some: { clinicId, active: true } },
      },
    });
    return row ? toProfessional(row) : null;
  }

  async findProfessionalById(professionalId: string): Promise<Professional | null> {
    const row = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    return row ? toProfessional(row) : null;
  }

  async listActiveProfessionals(clinicId: string): Promise<Professional[]> {
    const rows = await this.prisma.professional.findMany({
      where: {
        active: true,
        clinicProfessionals: { some: { clinicId, active: true } },
      },
      orderBy: { displayName: "asc" },
    });
    return rows.map(toProfessional);
  }

  async listActiveProfessionalsForService(clinicId: string, serviceId: string): Promise<Professional[]> {
    const rows = await this.prisma.professional.findMany({
      where: {
        active: true,
        clinicProfessionals: { some: { clinicId, active: true } },
        professionalServices: { some: { serviceId } },
      },
      orderBy: { displayName: "asc" },
    });
    return rows.map(toProfessional);
  }

  /* ── Professional (global operations) ────────────────────── */

  async professionalCanExecuteService(professionalId: string, serviceId: string): Promise<boolean> {
    const row = await this.prisma.professionalService.findUnique({
      where: { professionalId_serviceId: { professionalId, serviceId } },
    });
    return Boolean(row);
  }

  async createProfessional(input: CreateProfessionalInput): Promise<Professional> {
    const row = await this.prisma.professional.create({
      data: {
        displayName: input.displayName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        timezone: input.timezone ?? "America/Sao_Paulo",
      },
    });
    return toProfessional(row);
  }

  async addProfessionalService(professionalId: string, serviceId: string): Promise<void> {
    await this.prisma.professionalService.upsert({
      where: { professionalId_serviceId: { professionalId, serviceId } },
      create: { professionalId, serviceId },
      update: {},
    });
  }
}
