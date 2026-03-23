import type { PrismaClient } from "@prisma/client";

import { Clinic } from "@/modules/clinic/domain/Clinic";
import type {
  ClinicRepositoryPort,
  CreateClinicInput,
} from "@/modules/clinic/application/ports/ClinicRepositoryPort";

function toClinic(row: {
  id: string;
  name: string;
  legalName: string | null;
  document: string | null;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Clinic {
  return new Clinic({
    id: row.id,
    name: row.name,
    legalName: row.legalName,
    document: row.document,
    slug: row.slug,
    phone: row.phone,
    email: row.email,
    address: row.address,
    timezone: row.timezone,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class PrismaClinicRepository implements ClinicRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Clinic | null> {
    const row = await this.prisma.clinic.findUnique({ where: { id } });
    return row ? toClinic(row) : null;
  }

  async findBySlug(slug: string): Promise<Clinic | null> {
    const row = await this.prisma.clinic.findUnique({ where: { slug } });
    return row ? toClinic(row) : null;
  }

  async listActive(): Promise<Clinic[]> {
    const rows = await this.prisma.clinic.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return rows.map(toClinic);
  }

  async create(input: CreateClinicInput): Promise<Clinic> {
    const row = await this.prisma.clinic.create({
      data: {
        name: input.name,
        legalName: input.legalName ?? null,
        document: input.document ?? null,
        slug: input.slug,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        timezone: input.timezone ?? "America/Sao_Paulo",
      },
    });
    return toClinic(row);
  }

  async save(clinic: Clinic): Promise<Clinic> {
    const data = clinic.toPrimitives();
    const row = await this.prisma.clinic.update({
      where: { id: data.id },
      data: {
        name: data.name,
        legalName: data.legalName,
        document: data.document,
        slug: data.slug,
        phone: data.phone,
        email: data.email,
        address: data.address,
        timezone: data.timezone,
        active: data.active,
      },
    });
    return toClinic(row);
  }

  async addProfessional(clinicId: string, professionalId: string, role?: string): Promise<void> {
    await this.prisma.clinicProfessional.upsert({
      where: {
        clinicId_professionalId: { clinicId, professionalId },
      },
      create: {
        clinicId,
        professionalId,
        role: (role as "CLINIC_MANAGER" | "PROFESSIONAL") ?? "PROFESSIONAL",
      },
      update: {},
    });
  }

  async removeProfessional(clinicId: string, professionalId: string): Promise<void> {
    await this.prisma.clinicProfessional.update({
      where: {
        clinicId_professionalId: { clinicId, professionalId },
      },
      data: { active: false },
    });
  }

  async listProfessionalIds(clinicId: string): Promise<string[]> {
    const rows = await this.prisma.clinicProfessional.findMany({
      where: { clinicId, active: true },
      select: { professionalId: true },
    });
    return rows.map((r) => r.professionalId);
  }
}
