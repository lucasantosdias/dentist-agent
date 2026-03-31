import type { AppointmentRepositoryPort } from "@/modules/scheduling/application/ports/AppointmentRepositoryPort";

export type ProcessOverdueInput = {
  clinicId: string;
  now: Date;
  graceMinutes: number;
};

export type ProcessOverdueResult = {
  processedCount: number;
  appointmentIds: string[];
};

/**
 * Lifecycle processor that marks overdue CONFIRMED appointments as NO_SHOW.
 *
 * An appointment is considered overdue when:
 * - status === CONFIRMED
 * - startsAt + graceMinutes < now
 * - No check-in (IN_PROGRESS) or completion occurred
 *
 * This use case is idempotent — running it multiple times with the same
 * parameters produces the same result.
 *
 * Multi-tenant: always scoped by clinicId.
 */
export class ProcessOverdueAppointmentsUseCase {
  constructor(
    private readonly appointmentRepository: AppointmentRepositoryPort,
  ) {}

  async execute(input: ProcessOverdueInput): Promise<ProcessOverdueResult> {
    const cutoffTime = new Date(
      input.now.getTime() - input.graceMinutes * 60_000,
    );

    const overdueAppointments = await this.appointmentRepository.listOverdueConfirmed(
      input.clinicId,
      cutoffTime,
    );

    const processedIds: string[] = [];

    for (const appointment of overdueAppointments) {
      try {
        appointment.markNoShow(input.now);
        await this.appointmentRepository.save(appointment);
        processedIds.push(appointment.id);
        console.log(
          `[ProcessOverdue] Marked appointment ${appointment.id} as NO_SHOW ` +
          `(clinic=${input.clinicId}, scheduled=${appointment.startsAt.toISOString()})`,
        );
      } catch (err) {
        console.error(
          `[ProcessOverdue] Failed to process appointment ${appointment.id}:`,
          err,
        );
      }
    }

    return {
      processedCount: processedIds.length,
      appointmentIds: processedIds,
    };
  }
}
