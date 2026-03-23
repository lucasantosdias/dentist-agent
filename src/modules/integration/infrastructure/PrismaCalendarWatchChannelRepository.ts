import type { PrismaClient, CalendarWatchChannel as PrismaChannel } from "@prisma/client";
import type {
  CalendarWatchChannelRepositoryPort,
  CreateWatchChannelInput,
} from "@/modules/integration/application/ports/CalendarWatchChannelRepositoryPort";
import { CalendarWatchChannel } from "@/modules/integration/domain/CalendarWatchChannel";

function toDomain(row: PrismaChannel): CalendarWatchChannel {
  return new CalendarWatchChannel({
    id: row.id,
    professionalId: row.professionalId,
    channelId: row.channelId,
    resourceId: row.resourceId,
    expiration: row.expiration,
  });
}

export class PrismaCalendarWatchChannelRepository implements CalendarWatchChannelRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateWatchChannelInput): Promise<CalendarWatchChannel> {
    const row = await this.prisma.calendarWatchChannel.create({
      data: {
        professionalId: input.professionalId,
        channelId: input.channelId,
        resourceId: input.resourceId,
        expiration: input.expiration,
      },
    });
    return toDomain(row);
  }

  async findByChannelId(channelId: string): Promise<CalendarWatchChannel | null> {
    const row = await this.prisma.calendarWatchChannel.findUnique({
      where: { channelId },
    });
    return row ? toDomain(row) : null;
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.prisma.calendarWatchChannel.deleteMany({
      where: { expiration: { lt: now } },
    });
    return result.count;
  }

  async deleteByProfessional(professionalId: string): Promise<void> {
    await this.prisma.calendarWatchChannel.deleteMany({
      where: { professionalId },
    });
  }
}
