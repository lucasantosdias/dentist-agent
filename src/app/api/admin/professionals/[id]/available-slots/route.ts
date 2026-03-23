import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getEnv } from "@/config/env";
import { getContainer } from "@/server/container";
import { prisma } from "@/server/db/prisma";
import { PrismaCatalogRepository } from "@/modules/catalog/infrastructure/PrismaCatalogRepository";
import { toIsoWithTimezone } from "@/shared/time";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/professionals/:id/available-slots?serviceCode=LIMPEZA&date=2026-03-13
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: professionalId } = await context.params;

  const serviceCode = request.nextUrl.searchParams.get("service_code")
    ?? request.nextUrl.searchParams.get("serviceCode");
  const dateStr = request.nextUrl.searchParams.get("date");

  if (!serviceCode || !dateStr) {
    return NextResponse.json(
      { error: "service_code and date query params are required" },
      { status: 400 },
    );
  }

  const env = getEnv();
  const clinicId = request.nextUrl.searchParams.get("clinic_id") ?? env.DEFAULT_CLINIC_ID;
  const catalogRepo = new PrismaCatalogRepository(prisma);
  const service = await catalogRepo.findServiceByCode(clinicId, serviceCode);
  if (!service) {
    return NextResponse.json({ error: `Service not found: ${serviceCode}` }, { status: 404 });
  }

  const targetDate = new Date(dateStr + "T12:00:00-03:00"); // noon in São Paulo timezone
  const now = new Date();

  const container = getContainer();
  const result = await container.generateAvailableSlotsUseCase.execute({
    serviceId: service.id,
    professionalId,
    targetDate,
    now,
    limit: 20,
  });

  if (!result.ok) {
    const status = result.error === "NO_AVAILABILITY_RULES" ? 200 : 404;
    if (result.error === "NO_AVAILABILITY_RULES") {
      return NextResponse.json({ slots: [], message: "No availability rules for this day" });
    }
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    professional: professionalId,
    service: serviceCode,
    date: dateStr,
    slots: result.slots.map((s) => ({
      starts_at: toIsoWithTimezone(s.startsAt),
      ends_at: toIsoWithTimezone(s.endsAt),
      starts_at_utc: s.startsAt.toISOString(),
      ends_at_utc: s.endsAt.toISOString(),
    })),
  });
}
