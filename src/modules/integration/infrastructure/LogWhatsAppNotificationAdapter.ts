import type { NotificationPort, SendNotificationInput } from "@/modules/integration/application/ports/NotificationPort";

export class LogWhatsAppNotificationAdapter implements NotificationPort {
  async send(input: SendNotificationInput): Promise<{ sent: boolean; error?: string }> {
    if (input.channel !== "whatsapp") {
      return { sent: false, error: "LogWhatsAppNotificationAdapter only handles whatsapp channel" };
    }

    console.info("=== WHATSAPP NOTIFICATION (log adapter) ===");
    console.info(`To: ${input.recipient}`);
    console.info(`Template: ${input.templateKey}`);
    console.info(`Data: ${JSON.stringify(input.data, null, 2)}`);
    console.info("============================================");

    return { sent: true };
  }
}
