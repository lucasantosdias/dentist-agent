import { Conversation, type ConversationProps } from "@/modules/conversations/domain/Conversation";
import type { ConversationState } from "@/modules/conversations/domain/ConversationState";
import { randomUUID } from "crypto";

type ConversationOverrides = Partial<ConversationProps>;

export function buildConversation(overrides: ConversationOverrides = {}): Conversation {
  return new Conversation({
    id: overrides.id ?? randomUUID(),
    clinicId: overrides.clinicId ?? "00000000-0000-0000-0000-000000000001",
    patientId: overrides.patientId ?? randomUUID(),
    channel: overrides.channel ?? "sim",
    state: overrides.state ?? "AUTO",
    attempts: overrides.attempts ?? 0,
    currentIntent: overrides.currentIntent ?? null,
    collectedData: overrides.collectedData ?? {},
    missingRequirements: overrides.missingRequirements ?? [],
    currentFunnelStep: overrides.currentFunnelStep ?? null,
    lastMessageAt: overrides.lastMessageAt ?? null,
  });
}

export function buildBookingConversation(overrides: ConversationOverrides = {}): Conversation {
  return buildConversation({
    currentIntent: "BOOK_APPOINTMENT",
    currentFunnelStep: "COLLECTING_DATA",
    ...overrides,
  });
}
