import type { PrismaClient, ProfessionalAvailabilityException as PrismaException } from "@prisma/client";
import type {
  AvailabilityExceptionRepositoryPort,
  CreateAvailabilityExceptionInput,
} from "@/modules/scheduling/application/ports/AvailabilityExceptionRepositoryPort";
import { AvailabilityException } from "@/modules/scheduling/domain/AvailabilityException";
import type { AvailabilityExceptionSource, AvailabilityExceptionStatus } from "@/modules/scheduling/domain/AvailabilityException";

function toDomain(row: PrismaException): AvailabilityException {
  return new AvailabilityException({
    id: row.id,
    professionalId: row.professionalId,
    source: row.source as AvailabilityExceptionSource,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    reason: row.reason,
    externalEventId: row.externalEventId,
    status: row.status as AvailabilityExceptionStatus,
  });
}

export class PrismaAvailabilityExceptionRepository implements AvailabilityExceptionRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAvailabilityExceptionInput): Promise<AvailabilityException> {
    const row = await this.prisma.professionalAvailabilityException.create({
      data: {
        professionalId: input.professionalId,
        source: input.source,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reason: input.reason ?? null,
        externalEventId: input.externalEventId ?? null,
      },
    });
    return toDomain(row);
  }

  async save(exception: AvailabilityException): Promise<AvailabilityException> {
    const p = exception.toPrimitives();
    const row = await this.prisma.professionalAvailabilityException.update({
      where: { id: p.id },
      data: { status: p.status },
    });
    return toDomain(row);
  }

  async findActiveByProfessionalAndRange(
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<AvailabilityException[]> {
    const rows = await this.prisma.professionalAvailabilityException.findMany({
      where: {
        professionalId,
        status: "ACTIVE",
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    return rows.map(toDomain);
  }

  async findByExternalEventId(
    professionalId: string,
    externalEventId: string,
  ): Promise<AvailabilityException | null> {
    const row = await this.prisma.professionalAvailabilityException.findFirst({
      where: { professionalId, externalEventId },
    });
    return row ? toDomain(row) : null;
  }

  async cancelAllByProfessionalAndSource(
    professionalId: string,
    source: AvailabilityExceptionSource,
  ): Promise<number> {
    const result = await this.prisma.professionalAvailabilityException.updateMany({
      where: { professionalId, source, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    return result.count;
  }
}
