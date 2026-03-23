import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ clinicId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { clinicId } = await context.params;

    const patients = await prisma.patient.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(
      patients.map((p) => ({
        id: p.id,
        full_name: p.fullName,
        phone_e164: p.phoneE164,
        email: p.email,
        default_channel: p.defaultChannel,
        state: p.state,
        last_interaction_at: p.lastInteractionAt?.toISOString() ?? null,
        created_at: p.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/clinics/[clinicId]/patients]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
