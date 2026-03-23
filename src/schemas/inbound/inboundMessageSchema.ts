import { z } from "zod";

export const inboundMessageSchema = z
  .object({
    clinic_id: z.string().uuid().optional(),
    channel: z.literal("sim"),
    external_user_id: z.string().min(1),
    message_id: z.string().min(1),
    text: z.string().min(1),
  })
  .strict();

export type InboundMessageRequestDto = z.infer<typeof inboundMessageSchema>;
