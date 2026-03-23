import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 50,
      },
      slotHolds: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      patient: true,
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(conversation);
}
