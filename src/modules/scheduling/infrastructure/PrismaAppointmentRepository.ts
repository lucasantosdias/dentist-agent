import type { PrismaClient, Appointment as PrismaAppointment } from "@prisma/client";

import type {
  AppointmentRepositoryPort,
  CreateAppointmentInput,
} from "@/modules/scheduling/application/ports/AppointmentRepositoryPort";
import { Appointment } from "@/modules/scheduling/domain/Appointment";
import type { AppointmentStatus, CancelledBy } from "@/modules/scheduling/domain/AppointmentStatus";

function mapAppointment(row: PrismaAppointment): Appointment {
  return new Appointment({
    id: row.id,
    patientId: row.patientId,
    conversationId: row.conversationId,
    professionalId: row.professionalId,
    serviceId: row.serviceId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status as AppointmentStatus,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledBy as CancelledBy | null,
    cancellationReason: row.cancellationReason,
    createdBy: row.createdBy,
  });
}

export class PrismaAppointmentRepository implements AppointmentRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    const row = await this.prisma.appointment.create({
      data: {
        clinicId: input.clinicId,
        patientId: input.patientId,
        conversationId: input.conversationId ?? null,
        professionalId: input.professionalId,
        serviceId: input.serviceId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: input.status ?? "AGENDADA",
        createdBy: input.createdBy ?? "BOT",
      },
    });

    return mapAppointment(row);
  }

  async save(appointment: Appointment): Promise<Appointment> {
    const data = appointment.toPrimitives();
    const row = await this.prisma.appointment.update({
      where: { id: data.id },
      data: {
        status: data.status,
        cancelledAt: data.cancelledAt,
        cancelledBy: data.cancelledBy,
        cancellationReason: data.cancellationReason,
      },
    });

    return mapAppointment(row);
  }

  async listByPatientAndStatuses(
    patientId: string,
    statuses: AppointmentStatus[],
    fromDate?: Date,
  ): Promise<Appointment[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        patientId,
        status: { in: statuses },
        ...(fromDate ? { startsAt: { gte: fromDate } } : {}),
      },
      orderBy: { startsAt: "asc" },
    });

    return rows.map(mapAppointment);
  }
}
