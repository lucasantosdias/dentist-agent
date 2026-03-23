import type { Appointment } from "@/modules/scheduling/domain/Appointment";
import type { AppointmentStatus } from "@/modules/scheduling/domain/AppointmentStatus";

export type CreateAppointmentInput = {
  clinicId: string;
  patientId: string;
  conversationId?: string;
  professionalId: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  status?: AppointmentStatus;
  createdBy?: string;
};

export interface AppointmentRepositoryPort {
  create(input: CreateAppointmentInput): Promise<Appointment>;
  save(appointment: Appointment): Promise<Appointment>;
  listByPatientAndStatuses(
    patientId: string,
    statuses: AppointmentStatus[],
    fromDate?: Date,
  ): Promise<Appointment[]>;
}
