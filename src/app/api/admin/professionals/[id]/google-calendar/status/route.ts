import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: professionalId } = await context.params;

  try {
    const connection = await prisma.professionalCalendarConnection.findFirst({
      where: { professionalId },
    });

    if (!connection) {
      return NextResponse.json({ connected: false });
    }

    // Get recent appointments for this professional, then find their outbox records
    const outboxRecords = await prisma.calendarOutbox.findMany({
      where: {
        appointment: { professionalId },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Load appointment + patient info for each outbox record
    const enriched = await Promise.all(
      outboxRecords.map(async (r) => {
        const appointment = await prisma.appointment.findUnique({
          where: { id: r.appointmentId },
          include: { patient: { select: { fullName: true } } },
        });
        return {
          id: r.id,
          action: r.action,
          status: r.status,
          created_at: r.createdAt.toISOString(),
          appointment_id: r.appointmentId,
          patient_name: appointment?.patient?.fullName ?? null,
        };
      }),
    );

    return NextResponse.json({
      connected: true,
      google_calendar_id: connection.googleCalendarId,
      connected_at: connection.createdAt.toISOString(),
      last_sync_at: connection.lastSyncAt?.toISOString() ?? null,
      outbox_history: enriched,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
