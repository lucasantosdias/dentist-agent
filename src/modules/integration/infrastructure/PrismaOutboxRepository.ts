import type { PrismaClient } from "@prisma/client";

import type {
  CreateOutboxRecordInput,
  OutboxRecord,
  OutboxRepositoryPort,
} from "@/modules/integration/application/ports/OutboxRepositoryPort";

export class PrismaOutboxRepository implements OutboxRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async createPending(input: CreateOutboxRecordInput): Promise<void> {
    await this.prisma.calendarOutbox.create({
      data: {
        appointmentId: input.appointmentId,
        aggregateType: input.aggregateType,
        action: input.action,
        status: "PENDING",
        payloadJson: input.payload as never,
      },
    });
  }

  async findPending(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.calendarOutbox.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      appointmentId: r.appointmentId,
      aggregateType: r.aggregateType,
      action: r.action,
      status: r.status,
      externalEventId: r.externalEventId,
      payloadJson: r.payloadJson as Record<string, unknown>,
      createdAt: r.createdAt,
    }));
  }

  async markProcessing(id: string): Promise<void> {
    await this.prisma.calendarOutbox.update({
      where: { id },
      data: { status: "PROCESSING" },
    });
  }

  async markDone(id: string, externalEventId?: string): Promise<void> {
    await this.prisma.calendarOutbox.update({
      where: { id },
      data: {
        status: "DONE",
        ...(externalEventId ? { externalEventId } : {}),
      },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.calendarOutbox.update({
      where: { id },
      data: {
        status: "FAILED",
        lastError: error,
        attempts: { increment: 1 },
      },
    });
  }
}
