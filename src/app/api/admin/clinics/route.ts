import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(): Promise<NextResponse> {
  try {
    const clinics = await prisma.clinic.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      clinics.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        phone: c.phone,
        email: c.email,
        address: c.address,
        timezone: c.timezone,
        active: c.active,
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/clinics]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
