import type { PrismaClient, ProfessionalAvailabilityRule as PrismaRule } from "@prisma/client";
import type {
  AvailabilityRuleRepositoryPort,
  CreateAvailabilityRuleInput,
} from "@/modules/scheduling/application/ports/AvailabilityRuleRepositoryPort";
import { AvailabilityRule } from "@/modules/scheduling/domain/AvailabilityRule";

function toDomain(row: PrismaRule): AvailabilityRule {
  return new AvailabilityRule({
    id: row.id,
    professionalId: row.professionalId,
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    slotDurationMinutes: row.slotDurationMinutes,
    locationId: row.locationId,
  });
}

export class PrismaAvailabilityRuleRepository implements AvailabilityRuleRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAvailabilityRuleInput): Promise<AvailabilityRule> {
    const row = await this.prisma.professionalAvailabilityRule.create({
      data: {
        professionalId: input.professionalId,
        weekday: input.weekday,
        startTime: input.startTime,
        endTime: input.endTime,
        slotDurationMinutes: input.slotDurationMinutes ?? null,
        locationId: input.locationId ?? null,
      },
    });
    return toDomain(row);
  }

  async findByProfessionalAndWeekday(professionalId: string, weekday: number): Promise<AvailabilityRule[]> {
    const rows = await this.prisma.professionalAvailabilityRule.findMany({
      where: { professionalId, weekday },
      orderBy: { startTime: "asc" },
    });
    return rows.map(toDomain);
  }

  async findByProfessional(professionalId: string): Promise<AvailabilityRule[]> {
    const rows = await this.prisma.professionalAvailabilityRule.findMany({
      where: { professionalId },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });
    return rows.map(toDomain);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.professionalAvailabilityRule.delete({ where: { id } });
  }
}
