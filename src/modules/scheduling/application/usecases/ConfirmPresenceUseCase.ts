import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { AppointmentRepositoryPort } from "@/modules/scheduling/application/ports/AppointmentRepositoryPort";

export type ConfirmPresenceInput = {
  patient_id: string;
  requested_datetime_iso?: string | null;
  now: Date;
};

export type ConfirmPresenceResult =
  | { kind: "NO_APPOINTMENTS" }
  | {
      kind: "NEEDS_CLARIFICATION";
      options: Array<{ appointment_id: string; starts_at_iso: string; service_code: string; professional_name: string }>;
    }
  | {
      kind: "CONFIRMED";
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

export class ConfirmPresenceUseCase {
  constructor(
    private readonly appointmentRepository: AppointmentRepositoryPort,
    private readonly catalogRepository: CatalogRepositoryPort,
  ) {}

  async execute(input: ConfirmPresenceInput): Promise<ConfirmPresenceResult> {
    const appointments = await this.appointmentRepository.listByPatientAndStatuses(
      input.patient_id,
      ["AGENDADA"],
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

    selected.confirmPresence();
    const saved = await this.appointmentRepository.save(selected);

    const [service, professional] = await Promise.all([
      this.catalogRepository.findServiceById(saved.serviceId),
      this.catalogRepository.findProfessionalById(saved.professionalId),
    ]);

    return {
      kind: "CONFIRMED",
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
