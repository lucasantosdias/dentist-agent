import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainer } from "@/server/container";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: professionalId } = await context.params;
  const container = getContainer();

  if (!container.initiateGoogleCalendarConnectionUseCase) {
    return NextResponse.json(
      { error: "Google Calendar integration is not configured." },
      { status: 501 },
    );
  }

  try {
    const result = await container.initiateGoogleCalendarConnectionUseCase.execute({
      professionalId,
    });

    if (!result.ok) {
      const statusMap = { PROFESSIONAL_NOT_FOUND: 404, ALREADY_CONNECTED: 409 } as const;
      return NextResponse.json(
        { error: result.error },
        { status: statusMap[result.error] ?? 400 },
      );
    }

    return NextResponse.json({ oauth_url: result.value.oauthUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
