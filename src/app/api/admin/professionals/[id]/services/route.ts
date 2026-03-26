import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// GET — list services for a professional
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id: professionalId } = await context.params;

    const links = await prisma.professionalService.findMany({
      where: { professionalId },
      include: { service: true },
    });

    return NextResponse.json(
      links.map((l) => ({
        id: l.service.id,
        code: l.service.code,
        display_name: l.service.displayName,
        duration_minutes: l.service.durationMinutes,
      })),
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — replace all service associations
export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id: professionalId } = await context.params;
    const body = await request.json();
    const serviceIds: string[] =
      body.service_ids ?? body.serviceIds ?? [];

    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    });
    if (!professional) {
      return NextResponse.json(
        { error: "Professional not found" },
        { status: 404 },
      );
    }

    // Replace all service links in a transaction
    await prisma.$transaction([
      prisma.professionalService.deleteMany({
        where: { professionalId },
      }),
      ...(serviceIds.length > 0
        ? [
            prisma.professionalService.createMany({
              data: serviceIds.map((serviceId) => ({
                professionalId,
                serviceId,
              })),
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ service_ids: serviceIds });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
