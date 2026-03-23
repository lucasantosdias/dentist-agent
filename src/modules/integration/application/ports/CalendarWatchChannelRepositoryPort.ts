import type { CalendarWatchChannel } from "@/modules/integration/domain/CalendarWatchChannel";

export type CreateWatchChannelInput = {
  professionalId: string;
  channelId: string;
  resourceId: string;
  expiration: Date;
};

export interface CalendarWatchChannelRepositoryPort {
  create(input: CreateWatchChannelInput): Promise<CalendarWatchChannel>;
  findByChannelId(channelId: string): Promise<CalendarWatchChannel | null>;
  deleteExpired(now: Date): Promise<number>;
  deleteByProfessional(professionalId: string): Promise<void>;
}
