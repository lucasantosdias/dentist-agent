import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainer } from "@/server/container";

type RouteContext = { params: Promise<{ id: string }> };

function ruleToSnakeCase(rule: {
  id: string;
  professionalId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number | null;
  locationId: string | null;
}) {
  return {
    id: rule.id,
    professional_id: rule.professionalId,
    weekday: rule.weekday,
    start_time: rule.startTime,
    end_time: rule.endTime,
    slot_duration_minutes: rule.slotDurationMinutes,
    location_id: rule.locationId,
  };
}

// POST /api/admin/professionals/:id/availability-rules
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: professionalId } = await context.params;

  try {
    const body = await request.json();
    const {
      weekday,
      start_time: snakeStartTime, startTime: camelStartTime,
      end_time: snakeEndTime, endTime: camelEndTime,
      slot_duration_minutes: snakeSlotDuration, slotDurationMinutes: camelSlotDuration,
    } = body as {
      weekday: number;
      start_time?: string;
      startTime?: string;
      end_time?: string;
      endTime?: string;
      slot_duration_minutes?: number;
      slotDurationMinutes?: number;
    };

    const startTime = snakeStartTime ?? camelStartTime;
    const endTime = snakeEndTime ?? camelEndTime;
    const slotDurationMinutes = snakeSlotDuration ?? camelSlotDuration;

    if (weekday === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { error: "weekday, start_time, and end_time are required" },
        { status: 400 },
      );
    }

    const container = getContainer();
    const result = await container.createAvailabilityRuleUseCase.execute({
      professionalId,
      weekday,
      startTime,
      endTime,
      slotDurationMinutes: slotDurationMinutes ?? null,
    });

    if (!result.ok) {
      const status = result.error === "PROFESSIONAL_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    const rule = result.value.toPrimitives();
    return NextResponse.json(ruleToSnakeCase(rule), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// GET /api/admin/professionals/:id/availability-rules
export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id: professionalId } = await context.params;

    const { PrismaAvailabilityRuleRepository } = await import(
      "@/modules/scheduling/infrastructure/PrismaAvailabilityRuleRepository"
    );
    const { prisma } = await import("@/server/db/prisma");

    const repo = new PrismaAvailabilityRuleRepository(prisma);
    const rules = await repo.findByProfessional(professionalId);

    return NextResponse.json(rules.map((r) => ruleToSnakeCase(r.toPrimitives())));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/professionals/:id/availability-rules]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
