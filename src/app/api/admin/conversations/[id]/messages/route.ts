import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        text: m.text,
        llm_intent: m.llmIntent,
        entities_json: m.entitiesJson,
        created_at: m.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/conversations/:id/messages]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
