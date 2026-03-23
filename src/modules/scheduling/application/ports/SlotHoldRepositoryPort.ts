import type { SlotHold } from "@/modules/scheduling/domain/SlotHold";

export type CreateSlotHoldInput = {
  clinicId: string;
  conversationId: string;
  patientId: string;
  professionalId: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  expiresAt: Date;
};

export interface SlotHoldRepositoryPort {
  create(input: CreateSlotHoldInput): Promise<SlotHold>;
  save(hold: SlotHold): Promise<SlotHold>;
  expireHeldBefore(date: Date): Promise<number>;
  releaseHeldByConversation(conversationId: string): Promise<void>;
  findActiveByConversation(conversationId: string, now: Date): Promise<SlotHold | null>;
  listOverlappingActive(
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
    now: Date,
    ignoreHoldId?: string,
  ): Promise<SlotHold[]>;
}
