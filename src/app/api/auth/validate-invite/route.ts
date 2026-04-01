import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { createHash } from "crypto";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ valid: false });
  }

  const hashedToken = createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      inviteToken: hashedToken,
      inviteExpiresAt: { gt: new Date() },
    },
    select: { name: true, email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, name: user.name, email: user.email, role: user.role });
}
