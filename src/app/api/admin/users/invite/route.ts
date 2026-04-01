import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/server/db/prisma";
import { getContainer } from "@/server/container";
import { randomBytes, createHash } from "crypto";
import type { UserRole } from "@prisma/client";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const currentRole = session.user.role;

  if (currentRole !== "SUPERADMIN" && currentRole !== "ADMIN") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      email: string;
      name: string;
      role: UserRole;
      professionalId?: string;
    };

    const { email, name, role, professionalId } = body;

    if (!email || !name || !role) {
      return NextResponse.json({ error: "email, name e role sao obrigatorios" }, { status: 400 });
    }

    // ADMIN can only create PROFESSIONAL or ATTENDANT
    if (currentRole === "ADMIN" && (role === "SUPERADMIN" || role === "ADMIN")) {
      return NextResponse.json({ error: "Admin so pode criar profissionais e atendentes" }, { status: 403 });
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json({ error: "Email ja cadastrado" }, { status: 409 });
    }

    // If PROFESSIONAL, professionalId is required
    if (role === "PROFESSIONAL") {
      if (!professionalId) {
        return NextResponse.json({ error: "professionalId e obrigatorio para profissionais" }, { status: 400 });
      }
      const professional = await prisma.professional.findUnique({ where: { id: professionalId } });
      if (!professional) {
        return NextResponse.json({ error: "Profissional nao encontrado" }, { status: 404 });
      }
    }

    // Generate invite token
    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(rawToken).digest("hex");

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name,
        role,
        professionalId: role === "PROFESSIONAL" ? professionalId : null,
        inviteToken: hashedToken,
        inviteExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    // Send invite email
    const container = getContainer();
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/accept-invite?token=${rawToken}`;

    const roleLabels: Record<string, string> = {
      SUPERADMIN: "Super Administrador",
      ADMIN: "Administrador",
      PROFESSIONAL: "Profissional",
      ATTENDANT: "Atendente",
    };

    await container.notificationAdapter.send({
      channel: "email",
      recipient: user.email,
      subject: "Voce foi convidado para a Dentzi AI",
      templateKey: "user-invite",
      data: {
        name: user.name,
        role: roleLabels[user.role] ?? user.role,
        invite_url: inviteUrl,
      },
    });

    return NextResponse.json({ id: user.id, email: user.email, role: user.role }, { status: 201 });
  } catch (error) {
    console.error("[invite-user]", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
