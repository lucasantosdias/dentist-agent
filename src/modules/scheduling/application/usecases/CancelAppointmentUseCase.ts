import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { OutboxRepositoryPort } from "@/modules/integration/application/ports/OutboxRepositoryPort";
import type { AppointmentRepositoryPort } from "@/modules/scheduling/application/ports/AppointmentRepositoryPort";

export type CancelAppointmentInput = {
  patient_id: string;
  /** Additional patient IDs to search (for cross-session identity resolution). */
  all_patient_ids?: string[];
  requested_datetime_iso?: string | null;
  reason?: string | null;
  now: Date;
};

export type CancelAppointmentResult =
  | { kind: "NO_APPOINTMENTS" }
  | {
      kind: "NEEDS_CLARIFICATION";
      options: Array<{ appointment_id: string; starts_at_iso: string; service_code: string; professional_name: string }>;
    }
  | {
      kind: "CANCELLED";
      appointment: {
        id: string;
        status: string;
        starts_at_iso: string;
        ends_at_iso: string;
        service_code: string;
        professional_name: string;
      };
    };

function chooseAppointmentByDatetime(
  startsAtIso: string | null,
  appointments: Array<{ id: string; startsAt: Date }>,
): string | null {
  if (!startsAtIso) {
    return null;
  }

  const target = new Date(startsAtIso);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const candidate = appointments.find((item) => item.startsAt.getTime() === target.getTime());
  return candidate?.id ?? null;
}

export class CancelAppointmentUseCase {
  constructor(
    private readonly appointmentRepository: AppointmentRepositoryPort,
    private readonly catalogRepository: CatalogRepositoryPort,
    private readonly outboxRepository: OutboxRepositoryPort,
  ) {}

  async execute(input: CancelAppointmentInput): Promise<CancelAppointmentResult> {
    // Use all known patient IDs for cross-session identity resolution
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

    const selectedId = chooseAppointmentByDatetime(
      input.requested_datetime_iso ?? null,
      appointments.map((item) => ({ id: item.id, startsAt: item.startsAt })),
    );

    const selected =
      (selectedId ? appointments.find((item) => item.id === selectedId) : null) ??
      (appointments.length === 1 ? appointments[0] : null);

    if (!selected) {
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

      return {
        kind: "NEEDS_CLARIFICATION",
        options,
      };
    }

    selected.cancel("PACIENTE", input.reason?.trim() || null, input.now);
    const saved = await this.appointmentRepository.save(selected);

    const [service, professional] = await Promise.all([
      this.catalogRepository.findServiceById(saved.serviceId),
      this.catalogRepository.findProfessionalById(saved.professionalId),
    ]);

    await this.outboxRepository.createPending({
      appointmentId: saved.id,
      aggregateType: "APPOINTMENT",
      action: "CANCEL_EVENT",
      payload: {
        appointment_id: saved.id,
        patient_id: saved.patientId,
        starts_at: saved.startsAt.toISOString(),
        ends_at: saved.endsAt.toISOString(),
        service_code: service?.serviceCode ?? null,
        professional_name: professional?.name ?? null,
        cancelled_by: "PACIENTE",
        cancellation_reason: input.reason?.trim() || null,
      },
    });

    return {
      kind: "CANCELLED",
      appointment: {
        id: saved.id,
        status: saved.status,
        starts_at_iso: saved.startsAt.toISOString(),
        ends_at_iso: saved.endsAt.toISOString(),
        service_code: service?.serviceCode ?? "UNKNOWN",
        professional_name: professional?.name ?? "Profissional",
      },
    };
  }
}
