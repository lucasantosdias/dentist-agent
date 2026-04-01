import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import bcrypt from "bcrypt";
import { createHash } from "crypto";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { token, password } = await request.json() as { token: string; password: string };

    if (!token || !password) {
      return NextResponse.json({ error: "Token e senha sao obrigatorios" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Senha deve ter no minimo 8 caracteres" }, { status: 400 });
    }

    const hashedToken = createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        inviteToken: hashedToken,
        inviteExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Convite invalido ou expirado" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerifiedAt: new Date(),
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[accept-invite]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
