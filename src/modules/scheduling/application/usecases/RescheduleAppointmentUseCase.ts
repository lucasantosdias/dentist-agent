import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { OutboxRepositoryPort } from "@/modules/integration/application/ports/OutboxRepositoryPort";
import type { PatientRepositoryPort } from "@/modules/patients/application/ports/PatientRepositoryPort";
import type { AppointmentRepositoryPort } from "@/modules/scheduling/application/ports/AppointmentRepositoryPort";
import type { SchedulingAvailabilityPort } from "@/modules/scheduling/application/ports/SchedulingAvailabilityPort";
import { ProposeSlotsUseCase } from "@/modules/scheduling/application/usecases/ProposeSlotsUseCase";
import type { SchedulingPolicies } from "@/modules/scheduling/domain/SchedulingPolicies";
import { formatDateTimePtBr } from "@/shared/time";

/**
 * Reschedule an existing appointment.
 *
 * Strategy: cancel the old appointment + create a new one at the new time.
 * This matches the existing domain patterns and keeps calendar sync coherent
 * (CANCEL_EVENT for old + CREATE_EVENT for new).
 */

export type RescheduleInput = {
  patient_id: string;
  /** Additional patient IDs to search (for cross-session identity resolution). */
  all_patient_ids?: string[];
  clinic_id: string;
  patient_name?: string | null;
  patient_cpf?: string | null;
  requested_datetime_iso?: string | null;
  new_datetime_iso?: string | null;
  now: Date;
};

export type RescheduleResult =
  | { kind: "NO_APPOINTMENTS" }
  | {
      kind: "NEEDS_CLARIFICATION";
      options: Array<{
        appointment_id: string;
        starts_at_iso: string;
        service_code: string;
        professional_name: string;
      }>;
    }
  | { kind: "NEEDS_NEW_DATETIME"; current_appointment: AppointmentSummary }
  | { kind: "SLOT_UNAVAILABLE"; current_appointment: AppointmentSummary; available_times?: string[] }
  | {
      kind: "RESCHEDULED";
      old_appointment: AppointmentSummary;
      new_appointment: AppointmentSummary;
    };

type AppointmentSummary = {
  id: string;
  status: string;
  starts_at_iso: string;
  ends_at_iso: string;
  service_code: string;
  professional_name: string;
};

function chooseAppointmentByDatetime(
  startsAtIso: string | null,
  appointments: Array<{ id: string; startsAt: Date }>,
): string | null {
  if (!startsAtIso) return null;
  const target = new Date(startsAtIso);
  if (Number.isNaN(target.getTime())) return null;
  const candidate = appointments.find((a) => a.startsAt.getTime() === target.getTime());
  return candidate?.id ?? null;
}

export class RescheduleAppointmentUseCase {
  constructor(
    private readonly appointmentRepository: AppointmentRepositoryPort,
    private readonly catalogRepository: CatalogRepositoryPort,
    private readonly outboxRepository: OutboxRepositoryPort,
    private readonly availabilityPort: SchedulingAvailabilityPort,
    private readonly policies: SchedulingPolicies,
    private readonly patientRepository?: PatientRepositoryPort | null,
    private readonly proposeSlotsUseCase?: ProposeSlotsUseCase | null,
  ) {}

  async execute(input: RescheduleInput): Promise<RescheduleResult> {
    // Step 1: Find appointments across all known patient IDs (cross-session identity resolution)
    const patientIds = input.all_patient_ids?.length
      ? [...new Set(input.all_patient_ids)]
      : [input.patient_id];

    const appointments = await this.appointmentRepository.listByPatientIdsAndStatuses(
      patientIds,
      ["PENDING", "CONFIRMED"],
      input.now,
    );

    if (appointments.length === 0) {
      return { kind: "NO_APPOINTMENTS" };
    }

    // Step 2: Select which appointment to reschedule
    const selectedId = chooseAppointmentByDatetime(
      input.requested_datetime_iso ?? null,
      appointments.map((a) => ({ id: a.id, startsAt: a.startsAt })),
    );

    const selected =
      (selectedId ? appointments.find((a) => a.id === selectedId) : null) ??
      (appointments.length === 1 ? appointments[0] : null);

    if (!selected) {
      // Multiple appointments — ask which one
      const options = await Promise.all(
        appointments.slice(0, 5).map(async (appointment) => {
          const [service, professional] = await Promise.all([
            this.catalogRepository.findServiceById(appointment.serviceId),
            this.catalogRepository.findProfessionalById(appointment.professionalId),
          ]);
          return {
            appointment_id: appointment.id,
            starts_at_iso: appointment.startsAt.toISOString(),
            service_code: service?.serviceCode ?? "UNKNOWN",
            professional_name: professional?.name ?? "Profissional",
          };
        }),
      );
      return { kind: "NEEDS_CLARIFICATION", options };
    }

    // Resolve appointment context
    const [service, professional] = await Promise.all([
      this.catalogRepository.findServiceById(selected.serviceId),
      this.catalogRepository.findProfessionalById(selected.professionalId),
    ]);

    const currentSummary: AppointmentSummary = {
      id: selected.id,
      status: selected.status,
      starts_at_iso: selected.startsAt.toISOString(),
      ends_at_iso: selected.endsAt.toISOString(),
      service_code: service?.serviceCode ?? "UNKNOWN",
      professional_name: professional?.name ?? "Profissional",
    };

    // Step 3: Check if new datetime is provided
    if (!input.new_datetime_iso) {
      return { kind: "NEEDS_NEW_DATETIME", current_appointment: currentSummary };
    }

    const newStart = new Date(input.new_datetime_iso);
    if (Number.isNaN(newStart.getTime())) {
      return { kind: "NEEDS_NEW_DATETIME", current_appointment: currentSummary };
    }

    const durationMs = selected.endsAt.getTime() - selected.startsAt.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);

    // Step 4: Validate working hours
    if (!this.policies.isWithinWorkingHours(newStart, newEnd)) {
      const alternatives = await this.findAlternativeSlots(selected.professionalId, durationMs / 60_000, newStart, input.now);
      return { kind: "SLOT_UNAVAILABLE", current_appointment: currentSummary, available_times: alternatives };
    }

    // Step 5: Check slot availability (same professional)
    const isAvailable = await this.availabilityPort.isSlotAvailable({
      professionalId: selected.professionalId,
      startsAt: newStart,
      endsAt: newEnd,
      now: input.now,
    });

    if (!isAvailable) {
      const alternatives = await this.findAlternativeSlots(selected.professionalId, durationMs / 60_000, newStart, input.now);
      return { kind: "SLOT_UNAVAILABLE", current_appointment: currentSummary, available_times: alternatives };
    }

    // Step 6: Mark old appointment as RESCHEDULED (preserves history)
    selected.markRescheduled(input.now);
    await this.appointmentRepository.save(selected);

    // Outbox: cancel old calendar event
    await this.outboxRepository.createPending({
      appointmentId: selected.id,
      aggregateType: "APPOINTMENT",
      action: "CANCEL_EVENT",
      payload: {
        appointment_id: selected.id,
        patient_id: selected.patientId,
        starts_at: selected.startsAt.toISOString(),
        ends_at: selected.endsAt.toISOString(),
        cancelled_by: "SISTEMA",
        cancellation_reason: "Reagendamento",
      },
    });

    // Step 7: Create new appointment at the new time (same service, same professional)
    const newAppointment = await this.appointmentRepository.create({
      clinicId: input.clinic_id,
      patientId: input.patient_id,
      professionalId: selected.professionalId,
      serviceId: selected.serviceId,
      startsAt: newStart,
      endsAt: newEnd,
      status: "CONFIRMED",
      createdBy: "BOT",
    });

    // Outbox: create new calendar event
    await this.outboxRepository.createPending({
      appointmentId: newAppointment.id,
      aggregateType: "APPOINTMENT",
      action: "CREATE_EVENT",
      payload: {
        appointment_id: newAppointment.id,
        patient_id: input.patient_id,
        starts_at: newAppointment.startsAt.toISOString(),
        ends_at: newAppointment.endsAt.toISOString(),
        service_code: service?.serviceCode ?? null,
        professional_name: professional?.name ?? null,
      },
    });

    const newSummary: AppointmentSummary = {
      id: newAppointment.id,
      status: newAppointment.status,
      starts_at_iso: newAppointment.startsAt.toISOString(),
      ends_at_iso: newAppointment.endsAt.toISOString(),
      service_code: service?.serviceCode ?? "UNKNOWN",
      professional_name: professional?.name ?? "Profissional",
    };

    return {
      kind: "RESCHEDULED",
      old_appointment: currentSummary,
      new_appointment: newSummary,
    };
  }

  /**
   * Find alternative available slots for a professional near the requested time.
   */
  private async findAlternativeSlots(
    professionalId: string,
    durationMin: number,
    nearDate: Date,
    now: Date,
  ): Promise<string[]> {
    if (!this.proposeSlotsUseCase) return [];

    const slots = await this.proposeSlotsUseCase.execute({
      professionalId,
      serviceDurationMin: durationMin,
      requestedStartsAt: nearDate,
      now,
      limit: 5,
    });

    return slots.map((s) => formatDateTimePtBr(s.startsAt));
  }
}
