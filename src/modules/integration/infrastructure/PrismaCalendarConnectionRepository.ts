import type { PrismaClient, ProfessionalCalendarConnection as PrismaConn } from "@prisma/client";
import type {
  CalendarConnectionRepositoryPort,
  CreateCalendarConnectionInput,
} from "@/modules/integration/application/ports/CalendarConnectionRepositoryPort";
import { CalendarConnection } from "@/modules/integration/domain/CalendarConnection";
import type { CalendarProvider } from "@/modules/integration/domain/CalendarConnection";

function toDomain(row: PrismaConn): CalendarConnection {
  return new CalendarConnection({
    id: row.id,
    professionalId: row.professionalId,
    provider: row.provider as CalendarProvider,
    googleCalendarId: row.googleCalendarId,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    tokenExpiresAt: row.tokenExpiresAt,
    lastSyncAt: row.lastSyncAt,
  });
}

export class PrismaCalendarConnectionRepository implements CalendarConnectionRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(input: CreateCalendarConnectionInput): Promise<CalendarConnection> {
    const row = await this.prisma.professionalCalendarConnection.upsert({
      where: {
        professionalId_provider: {
          professionalId: input.professionalId,
          provider: input.provider,
        },
      },
      create: {
        professionalId: input.professionalId,
        provider: input.provider,
        googleCalendarId: input.googleCalendarId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
      },
      update: {
        googleCalendarId: input.googleCalendarId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
      },
    });
    return toDomain(row);
  }

  async save(connection: CalendarConnection): Promise<CalendarConnection> {
    const p = connection.toPrimitives();
    const row = await this.prisma.professionalCalendarConnection.update({
      where: { id: p.id },
      data: {
        accessToken: p.accessToken,
        refreshToken: p.refreshToken,
        tokenExpiresAt: p.tokenExpiresAt,
        lastSyncAt: p.lastSyncAt,
      },
    });
    return toDomain(row);
  }

  async findByProfessional(professionalId: string): Promise<CalendarConnection | null> {
    const row = await this.prisma.professionalCalendarConnection.findFirst({
      where: { professionalId },
    });
    return row ? toDomain(row) : null;
  }

  async deleteByProfessional(professionalId: string): Promise<void> {
    await this.prisma.professionalCalendarConnection.deleteMany({
      where: { professionalId },
    });
  }
}
