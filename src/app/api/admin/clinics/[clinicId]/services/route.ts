import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ clinicId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { clinicId } = await context.params;

    const services = await prisma.service.findMany({
      where: { clinicId, active: true },
      orderBy: { displayName: "asc" },
    });

    return NextResponse.json(
      services.map((s) => ({
        id: s.id,
        code: s.code,
        display_name: s.displayName,
        description: s.description,
        duration_minutes: s.durationMinutes,
        price: s.price,
        active: s.active,
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/clinics/[clinicId]/services]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
