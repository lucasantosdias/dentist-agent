import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getContainer } from "@/server/container";
import { randomBytes, createHash } from "crypto";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { email } = await request.json() as { email: string };

    if (!email) {
      return NextResponse.json({ ok: true });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.active) {
      return NextResponse.json({ ok: true });
    }

    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(rawToken).digest("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const container = getContainer();
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    await container.notificationAdapter.send({
      channel: "email",
      recipient: user.email,
      subject: "Recupere sua senha — Dentzi AI",
      templateKey: "password-reset",
      data: { name: user.name, reset_url: resetUrl },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[forgot-password]", error);
    return NextResponse.json({ ok: true });
  }
}
