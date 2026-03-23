export const slotHoldStatuses = ["HELD", "EXPIRED", "RELEASED", "CONVERTED"] as const;

export type SlotHoldStatus = (typeof slotHoldStatuses)[number];
