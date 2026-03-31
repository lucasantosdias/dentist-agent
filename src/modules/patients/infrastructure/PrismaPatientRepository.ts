import type { PrismaClient } from "@prisma/client";

import type { PatientRepositoryPort } from "@/modules/patients/application/ports/PatientRepositoryPort";
import { Patient } from "@/modules/patients/domain/Patient";

function toEntity(row: {
  id: string;
  clinicId: string;
  externalUserId: string;
  defaultChannel: string;
  fullName: string | null;
  cpf: string | null;
  phoneE164: string | null;
  birthDate: Date | null;
  state: "LEAD_NEW" | "LEAD_QUALIFIED" | "LEAD_INACTIVE" | "ACTIVE" | "INACTIVE";
  lastInteractionAt: Date | null;
}): Patient {
  return new Patient({
    id: row.id,
    clinicId: row.clinicId,
    externalUserId: row.externalUserId,
    defaultChannel: row.defaultChannel,
    fullName: row.fullName,
    cpf: row.cpf,
    phoneE164: row.phoneE164,
    birthDate: row.birthDate ? row.birthDate.toISOString().split("T")[0] : null,
    state: row.state,
    lastInteractionAt: row.lastInteractionAt,
  });
}

export class PrismaPatientRepository implements PatientRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findByChannelAndExternalUser(clinicId: string, channel: string, externalUserId: string): Promise<Patient | null> {
    const row = await this.prisma.patient.findUnique({
      where: {
        clinicId_defaultChannel_externalUserId: {
          clinicId,
          defaultChannel: channel,
          externalUserId,
        },
      },
    });

    return row ? toEntity(row) : null;
  }

  async create(clinicId: string, channel: string, externalUserId: string): Promise<Patient> {
    const row = await this.prisma.patient.create({
      data: {
        clinicId,
        defaultChannel: channel,
        externalUserId,
        state: "LEAD_NEW",
      },
    });

    return toEntity(row);
  }

  async save(patient: Patient): Promise<Patient> {
    const data = patient.toPrimitives();
    const row = await this.prisma.patient.update({
      where: { id: data.id },
      data: {
        fullName: data.fullName,
        cpf: data.cpf,
        phoneE164: data.phoneE164,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        state: data.state,
        lastInteractionAt: data.lastInteractionAt,
      },
    });

    return toEntity(row);
  }

  async findById(id: string): Promise<Patient | null> {
    const row = await this.prisma.patient.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByCpfAndClinic(clinicId: string, cpf: string): Promise<Patient[]> {
    const rows = await this.prisma.patient.findMany({
      where: { clinicId, cpf },
      orderBy: { lastInteractionAt: "desc" },
    });
    return rows.map(toEntity);
  }

  async findByClinicAndIdentity(clinicId: string, name?: string | null, cpf?: string | null): Promise<Patient[]> {
    if (!name && !cpf) return [];

    const conditions: Array<Record<string, unknown>> = [{ clinicId }];

    if (cpf) {
      conditions.push({ cpf });
    } else if (name) {
      conditions.push({ fullName: { equals: name, mode: "insensitive" } });
    }

    const rows = await this.prisma.patient.findMany({
      where: { AND: conditions },
      orderBy: { lastInteractionAt: "desc" },
      take: 5,
    });

    return rows.map(toEntity);
  }
}
