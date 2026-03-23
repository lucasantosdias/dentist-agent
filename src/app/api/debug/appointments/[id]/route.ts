import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: true,
      professional: true,
      service: true,
      calendarOutbox: true,
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(appointment);
}
