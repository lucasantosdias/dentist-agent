import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ clinicId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { clinicId } = await context.params;

    const appointments = await prisma.appointment.findMany({
      where: { clinicId },
      orderBy: { startsAt: "desc" },
      take: 100,
      include: {
        service: { select: { code: true, displayName: true } },
        professional: { select: { displayName: true } },
        patient: { select: { fullName: true, phoneE164: true, defaultChannel: true } },
      },
    });

    return NextResponse.json(
      appointments.map((a) => ({
        id: a.id,
        status: a.status,
        starts_at: a.startsAt.toISOString(),
        ends_at: a.endsAt.toISOString(),
        service_code: a.service.code,
        service_name: a.service.displayName,
        professional_name: a.professional.displayName,
        patient_name: a.patient.fullName ?? "\u2014",
        patient_phone: a.patient.phoneE164 ?? "\u2014",
        patient_channel: a.patient.defaultChannel,
        created_by: a.createdBy,
        created_at: a.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/clinics/[clinicId]/appointments]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
