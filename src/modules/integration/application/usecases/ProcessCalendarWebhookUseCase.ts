import type { CalendarWatchChannelRepositoryPort } from "@/modules/integration/application/ports/CalendarWatchChannelRepositoryPort";
import type { RunCalendarIncrementalSyncUseCase } from "./RunCalendarIncrementalSyncUseCase";

export type ProcessCalendarWebhookInput = {
  channelId: string;
  resourceId: string;
};

export class ProcessCalendarWebhookUseCase {
  constructor(
    private readonly watchChannelRepo: CalendarWatchChannelRepositoryPort,
    private readonly incrementalSyncUseCase: RunCalendarIncrementalSyncUseCase,
  ) {}

  async execute(input: ProcessCalendarWebhookInput): Promise<void> {
    const channel = await this.watchChannelRepo.findByChannelId(input.channelId);
    if (!channel) {
      console.warn(`Unknown webhook channel: ${input.channelId}`);
      return;
    }

    if (channel.resourceId !== input.resourceId) {
      console.warn(`Resource ID mismatch for channel ${input.channelId}`);
      return;
    }

    if (channel.isExpired(new Date())) {
      console.warn(`Expired watch channel: ${input.channelId}`);
      return;
    }

    await this.incrementalSyncUseCase.execute({ professionalId: channel.professionalId });
  }
}
