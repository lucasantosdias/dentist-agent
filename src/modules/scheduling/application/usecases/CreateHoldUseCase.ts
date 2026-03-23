import type { SchedulingAvailabilityPort } from "@/modules/scheduling/application/ports/SchedulingAvailabilityPort";
import type { SlotHoldRepositoryPort } from "@/modules/scheduling/application/ports/SlotHoldRepositoryPort";
import type { SchedulingPolicies } from "@/modules/scheduling/domain/SchedulingPolicies";
import { fail, ok, type Result } from "@/shared/result";

export type CreateHoldInput = {
  clinic_id: string;
  conversation_id: string;
  patient_id: string;
  professional_id: string;
  service_id: string;
  starts_at: Date;
  ends_at: Date;
  now: Date;
};

export type CreateHoldError = "INVALID_SLOT" | "UNAVAILABLE";

export class CreateHoldUseCase {
  constructor(
    private readonly slotHoldRepository: SlotHoldRepositoryPort,
    private readonly availabilityPort: SchedulingAvailabilityPort,
    private readonly policies: SchedulingPolicies,
  ) {}

  async execute(input: CreateHoldInput): Promise<Result<{ hold_id: string; expires_at: Date }, CreateHoldError>> {
    if (!this.policies.isWithinWorkingHours(input.starts_at, input.ends_at)) {
      return fail("INVALID_SLOT");
    }

    await this.slotHoldRepository.expireHeldBefore(input.now);

    const available = await this.availabilityPort.isSlotAvailable({
      professionalId: input.professional_id,
      startsAt: input.starts_at,
      endsAt: input.ends_at,
      now: input.now,
    });

    if (!available) {
      return fail("UNAVAILABLE");
    }

    await this.slotHoldRepository.releaseHeldByConversation(input.conversation_id);

    const expiresAt = new Date(input.now.getTime() + this.policies.holdTtlMinutes * 60_000);
    const hold = await this.slotHoldRepository.create({
      clinicId: input.clinic_id,
      conversationId: input.conversation_id,
      patientId: input.patient_id,
      professionalId: input.professional_id,
      serviceId: input.service_id,
      startsAt: input.starts_at,
      endsAt: input.ends_at,
      expiresAt,
    });

    return ok({ hold_id: hold.id, expires_at: expiresAt });
  }
}
