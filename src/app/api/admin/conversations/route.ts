import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(): Promise<NextResponse> {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        patient: { select: { fullName: true, phoneE164: true, defaultChannel: true, state: true } },
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json(
      conversations.map((c) => ({
        id: c.id,
        state: c.state,
        channel: c.channel,
        current_intent: c.currentIntent,
        current_funnel_step: c.currentFunnelStep,
        message_count: c._count.messages,
        patient_name: c.patient.fullName ?? "\u2014",
        patient_state: c.patient.state,
        patient_channel: c.patient.defaultChannel,
        last_message_at: c.lastMessageAt?.toISOString() ?? null,
        created_at: c.createdAt.toISOString(),
        updated_at: c.updatedAt.toISOString(),
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/conversations]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
