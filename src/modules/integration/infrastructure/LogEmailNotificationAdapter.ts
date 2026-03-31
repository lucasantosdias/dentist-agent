import type { NotificationPort, SendNotificationInput } from "@/modules/integration/application/ports/NotificationPort";

export class LogEmailNotificationAdapter implements NotificationPort {
  async send(input: SendNotificationInput): Promise<{ sent: boolean; error?: string }> {
    if (input.channel !== "email") {
      return { sent: false, error: "LogEmailNotificationAdapter only handles email channel" };
    }

    console.info("=== EMAIL NOTIFICATION (log adapter) ===");
    console.info(`To: ${input.recipient}`);
    console.info(`Subject: ${input.subject ?? input.templateKey}`);
    console.info(`Template: ${input.templateKey}`);
    console.info(`Data: ${JSON.stringify(input.data, null, 2)}`);
    console.info("========================================");

    return { sent: true };
  }
}
