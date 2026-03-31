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

  /**
   * Same as listByPatientAndStatuses but accepts multiple patient IDs.
   * Used for cross-session identity resolution when a patient has
   * duplicate records.
   */
  listByPatientIdsAndStatuses(
    patientIds: string[],
    statuses: AppointmentStatus[],
    fromDate?: Date,
  ): Promise<Appointment[]>;

  /**
   * Find CONFIRMED appointments whose scheduled start time has passed
   * by at least `graceMinutes`, scoped to a specific clinic.
   * Used by the overdue lifecycle processor.
   */
  listOverdueConfirmed(clinicId: string, cutoffTime: Date): Promise<Appointment[]>;
}
