export type NotificationChannel = "email" | "whatsapp";

export type SendNotificationInput = {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  templateKey: string;
  data: Record<string, string>;
};

export interface NotificationPort {
  send(input: SendNotificationInput): Promise<{ sent: boolean; error?: string }>;
}
