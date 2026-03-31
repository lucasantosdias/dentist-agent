import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainer } from "@/server/container";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: professionalId } = await context.params;
  const container = getContainer();

  try {
    const body = await request.json() as { channel: string; oauth_url: string };
    const { channel, oauth_url } = body;

    if (!channel || !oauth_url) {
      return NextResponse.json({ error: "channel and oauth_url are required" }, { status: 400 });
    }

    if (channel !== "email" && channel !== "whatsapp") {
      return NextResponse.json({ error: "channel must be 'email' or 'whatsapp'" }, { status: 400 });
    }

    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!professional) {
      return NextResponse.json({ error: "Professional not found" }, { status: 404 });
    }

    const recipient = channel === "email" ? professional.email : professional.phone;
    if (!recipient) {
      return NextResponse.json(
        { error: `Professional has no ${channel === "email" ? "email" : "phone"} registered` },
        { status: 422 },
      );
    }

    const result = await container.notificationAdapter.send({
      channel,
      recipient,
      subject: "Conecte seu Google Calendar — Dentzi AI",
      templateKey: "google-calendar-link",
      data: {
        professional_name: professional.displayName,
        oauth_url,
      },
    });

    if (!result.sent) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
