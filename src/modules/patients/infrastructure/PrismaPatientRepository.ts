import type { PrismaClient } from "@prisma/client";

import type { PatientRepositoryPort } from "@/modules/patients/application/ports/PatientRepositoryPort";
import { Patient } from "@/modules/patients/domain/Patient";

function toEntity(row: {
  id: string;
  clinicId: string;
  externalUserId: string;
  defaultChannel: string;
  fullName: string | null;
  phoneE164: string | null;
  state: "LEAD_NEW" | "LEAD_QUALIFIED" | "LEAD_INACTIVE" | "ACTIVE" | "INACTIVE";
  lastInteractionAt: Date | null;
}): Patient {
  return new Patient({
    id: row.id,
    clinicId: row.clinicId,
    externalUserId: row.externalUserId,
    defaultChannel: row.defaultChannel,
    fullName: row.fullName,
    phoneE164: row.phoneE164,
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
        phoneE164: data.phoneE164,
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
}
