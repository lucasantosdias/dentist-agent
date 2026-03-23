import type { AvailabilityException } from "@/modules/scheduling/domain/AvailabilityException";
import type { AvailabilityExceptionSource } from "@/modules/scheduling/domain/AvailabilityException";

export type CreateAvailabilityExceptionInput = {
  professionalId: string;
  source: AvailabilityExceptionSource;
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
  externalEventId?: string | null;
};

export interface AvailabilityExceptionRepositoryPort {
  create(input: CreateAvailabilityExceptionInput): Promise<AvailabilityException>;
  save(exception: AvailabilityException): Promise<AvailabilityException>;
  findActiveByProfessionalAndRange(
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<AvailabilityException[]>;
  findByExternalEventId(
    professionalId: string,
    externalEventId: string,
  ): Promise<AvailabilityException | null>;
}
