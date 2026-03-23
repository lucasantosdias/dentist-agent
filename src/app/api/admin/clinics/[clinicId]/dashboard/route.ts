import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ clinicId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { clinicId } = await context.params;

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    const [
      clinic,
      professionalsCount,
      patientsCount,
      servicesCount,
      appointmentsToday,
      appointmentsUpcoming,
      conversationsActive,
    ] = await Promise.all([
      prisma.clinic.findUniqueOrThrow({
        where: { id: clinicId },
        select: { id: true, name: true },
      }),
      prisma.clinicProfessional.count({
        where: { clinicId, active: true },
      }),
      prisma.patient.count({
        where: { clinicId },
      }),
      prisma.service.count({
        where: { clinicId, active: true },
      }),
      prisma.appointment.count({
        where: {
          clinicId,
          startsAt: { gte: todayStart, lt: todayEnd },
        },
      }),
      prisma.appointment.count({
        where: {
          clinicId,
          startsAt: { gt: now },
        },
      }),
      prisma.conversation.count({
        where: {
          clinicId,
          state: { in: ["AUTO", "WAITING", "HUMAN"] },
        },
      }),
    ]);

    return NextResponse.json({
      clinic: { id: clinic.id, name: clinic.name },
      professionals_count: professionalsCount,
      patients_count: patientsCount,
      services_count: servicesCount,
      appointments_today: appointmentsToday,
      appointments_upcoming: appointmentsUpcoming,
      conversations_active: conversationsActive,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/clinics/[clinicId]/dashboard]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
