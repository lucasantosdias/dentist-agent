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

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { clinicId } = await context.params;
    const body = await request.json();
    const {
      code, display_name, description, duration_minutes, price,
    } = body as {
      code?: string;
      display_name?: string;
      description?: string;
      duration_minutes?: number;
      price?: number;
    };

    if (!code || !display_name || !duration_minutes) {
      return NextResponse.json(
        { error: "code, display_name, and duration_minutes are required" },
        { status: 400 },
      );
    }

    const service = await prisma.service.create({
      data: {
        clinicId,
        code: code.toUpperCase().replace(/\s+/g, "_"),
        displayName: display_name,
        description: description ?? null,
        durationMinutes: duration_minutes,
        price: price ?? null,
      },
    });

    return NextResponse.json({
      id: service.id,
      code: service.code,
      display_name: service.displayName,
      description: service.description,
      duration_minutes: service.durationMinutes,
      price: service.price,
      active: service.active,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Servico com este codigo ja existe nesta clinica" }, { status: 409 });
    }
    console.error("[POST /api/admin/clinics/[clinicId]/services]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
