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

    const outboxRecords = await prisma.calendarOutbox.findMany({
      where: {
        appointment: { professionalId },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        appointment: {
          include: {
            patient: { select: { knownName: true, fullName: true } },
          },
        },
      },
    });

    return NextResponse.json({
      connected: true,
      google_calendar_id: connection.googleCalendarId,
      connected_at: connection.createdAt.toISOString(),
      last_sync_at: connection.lastSyncAt?.toISOString() ?? null,
      outbox_history: outboxRecords.map((r) => ({
        id: r.id,
        action: r.action,
        status: r.status,
        created_at: r.createdAt.toISOString(),
        appointment_id: r.appointmentId,
        patient_name: r.appointment?.patient?.knownName ?? r.appointment?.patient?.fullName ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
