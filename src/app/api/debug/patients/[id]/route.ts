import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      conversations: {
        orderBy: { updatedAt: "desc" },
        take: 10,
      },
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 10,
      },
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(patient);
}
