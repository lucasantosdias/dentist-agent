export const conversationStates = ["AUTO", "WAITING", "HUMAN", "FINALIZADA"] as const;

export type ConversationState = (typeof conversationStates)[number];
