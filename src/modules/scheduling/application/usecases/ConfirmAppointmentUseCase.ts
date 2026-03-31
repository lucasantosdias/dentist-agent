import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { OutboxRepositoryPort } from "@/modules/integration/application/ports/OutboxRepositoryPort";
import type { AppointmentRepositoryPort } from "@/modules/scheduling/application/ports/AppointmentRepositoryPort";
import type { SchedulingAvailabilityPort } from "@/modules/scheduling/application/ports/SchedulingAvailabilityPort";
import type { SlotHoldRepositoryPort } from "@/modules/scheduling/application/ports/SlotHoldRepositoryPort";
import { fail, ok, type Result } from "@/shared/result";

export type ConfirmAppointmentInput = {
  clinic_id: string;
  conversation_id: string;
  patient_id: string;
  patient_name: string;
  now: Date;
};

export type ConfirmAppointmentError = "NO_ACTIVE_HOLD" | "HOLD_EXPIRED" | "UNAVAILABLE" | "CATALOG_NOT_FOUND";

export type ConfirmAppointmentOutput = {
  appointment_id: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  professional_name: string;
  service_code: string;
};

export class ConfirmAppointmentUseCase {
  constructor(
    private readonly slotHoldRepository: SlotHoldRepositoryPort,
    private readonly appointmentRepository: AppointmentRepositoryPort,
    private readonly availabilityPort: SchedulingAvailabilityPort,
    private readonly catalogRepository: CatalogRepositoryPort,
    private readonly outboxRepository: OutboxRepositoryPort,
  ) {}

  async execute(
    input: ConfirmAppointmentInput,
  ): Promise<Result<ConfirmAppointmentOutput, ConfirmAppointmentError>> {
    await this.slotHoldRepository.expireHeldBefore(input.now);

    const hold = await this.slotHoldRepository.findActiveByConversation(input.conversation_id, input.now);
    if (!hold) {
      return fail("NO_ACTIVE_HOLD");
    }

    if (hold.isExpired(input.now)) {
      hold.expire();
      await this.slotHoldRepository.save(hold);
      return fail("HOLD_EXPIRED");
    }

    const available = await this.availabilityPort.isSlotAvailable({
      professionalId: hold.professionalId,
      startsAt: hold.startsAt,
      endsAt: hold.endsAt,
      now: input.now,
      ignoreHoldId: hold.id,
    });

    if (!available) {
      hold.release();
      await this.slotHoldRepository.save(hold);
      return fail("UNAVAILABLE");
    }

    const [service, professional] = await Promise.all([
      this.catalogRepository.findServiceById(hold.serviceId),
      this.catalogRepository.findProfessionalById(hold.professionalId),
    ]);

    if (!service || !professional) {
      return fail("CATALOG_NOT_FOUND");
    }

    const appointment = await this.appointmentRepository.create({
      clinicId: input.clinic_id,
      patientId: input.patient_id,
      conversationId: input.conversation_id,
      professionalId: hold.professionalId,
      serviceId: hold.serviceId,
      startsAt: hold.startsAt,
      endsAt: hold.endsAt,
      status: "CONFIRMED",
      createdBy: "BOT",
    });

    hold.convert();
    await this.slotHoldRepository.save(hold);

    await this.outboxRepository.createPending({
      appointmentId: appointment.id,
      aggregateType: "APPOINTMENT",
      action: "CREATE_EVENT",
      payload: {
        patient_name: input.patient_name,
        professional_name: professional.name,
        service_name: service.name,
        service_code: service.serviceCode,
        starts_at: appointment.startsAt.toISOString(),
        ends_at: appointment.endsAt.toISOString(),
      },
    });

    return ok({
      appointment_id: appointment.id,
      status: appointment.status,
      starts_at: appointment.startsAt,
      ends_at: appointment.endsAt,
      professional_name: professional.name,
      service_code: service.serviceCode,
    });
  }
}
