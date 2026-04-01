import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/server/db/prisma";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  if (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        emailVerifiedAt: true,
        createdAt: true,
        professional: {
          select: { displayName: true },
        },
      },
    });

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        active: u.active,
        verified: !!u.emailVerifiedAt,
        created_at: u.createdAt.toISOString(),
        professional_name: u.professional?.displayName ?? null,
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
