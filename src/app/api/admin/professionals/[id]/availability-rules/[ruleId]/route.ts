import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = {
  params: Promise<{ id: string; ruleId: string }>;
};

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id: professionalId, ruleId } = await context.params;

    const rule = await prisma.professionalAvailabilityRule.findFirst({
      where: { id: ruleId, professionalId },
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 },
      );
    }

    await prisma.professionalAvailabilityRule.delete({
      where: { id: ruleId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
