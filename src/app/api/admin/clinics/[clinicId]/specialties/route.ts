import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ clinicId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { clinicId } = await context.params;

    const specialties = await prisma.specialty.findMany({
      where: { clinicId, active: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      specialties.map((s) => ({ id: s.id, name: s.name })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET specialties]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { clinicId } = await context.params;
    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const specialty = await prisma.specialty.create({
      data: {
        clinicId,
        name: name.trim(),
      },
    });

    return NextResponse.json({ id: specialty.id, name: specialty.name }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Especialidade ja existe" }, { status: 409 });
    }
    console.error("[POST specialties]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { clinicId } = await context.params;
    const { searchParams } = new URL(request.url);
    const specialtyId = searchParams.get("id");

    if (!specialtyId) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
    }

    await prisma.specialty.updateMany({
      where: { id: specialtyId, clinicId },
      data: { active: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[DELETE specialties]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
