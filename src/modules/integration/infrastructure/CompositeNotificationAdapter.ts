import type { NotificationPort, SendNotificationInput } from "@/modules/integration/application/ports/NotificationPort";

export class CompositeNotificationAdapter implements NotificationPort {
  constructor(
    private readonly emailAdapter: NotificationPort,
    private readonly whatsappAdapter: NotificationPort,
  ) {}

  async send(input: SendNotificationInput): Promise<{ sent: boolean; error?: string }> {
    switch (input.channel) {
      case "email":
        return this.emailAdapter.send(input);
      case "whatsapp":
        return this.whatsappAdapter.send(input);
      default:
        return { sent: false, error: `Unsupported channel: ${input.channel}` };
    }
  }
}
