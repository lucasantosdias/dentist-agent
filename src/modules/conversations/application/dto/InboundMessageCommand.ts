export type InboundMessageCommand = {
  clinic_id?: string;
  channel: "sim";
  external_user_id: string;
  message_id: string;
  text: string;
};
