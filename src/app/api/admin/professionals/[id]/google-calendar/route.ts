import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainer } from "@/server/container";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/professionals/:id/google-calendar — Connect Google Calendar
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: professionalId } = await context.params;

  const container = getContainer();

  if (!container.connectGoogleCalendarUseCase) {
    return NextResponse.json(
      { error: "Google Calendar integration is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 501 },
    );
  }

  try {
    const body = await request.json();
    const {
      google_calendar_id: snakeCalId, googleCalendarId: camelCalId,
      access_token: snakeAccessToken, accessToken: camelAccessToken,
      refresh_token: snakeRefreshToken, refreshToken: camelRefreshToken,
      token_expires_at: snakeTokenExpires, tokenExpiresAt: camelTokenExpires,
    } = body as Record<string, string | undefined>;

    const googleCalendarId = snakeCalId ?? camelCalId;
    const accessToken = snakeAccessToken ?? camelAccessToken;
    const refreshToken = snakeRefreshToken ?? camelRefreshToken;
    const tokenExpiresAt = snakeTokenExpires ?? camelTokenExpires;

    if (!googleCalendarId || !accessToken || !refreshToken || !tokenExpiresAt) {
      return NextResponse.json(
        { error: "google_calendar_id, access_token, refresh_token, and token_expires_at are required" },
        { status: 400 },
      );
    }

    const result = await container.connectGoogleCalendarUseCase.execute({
      professionalId,
      googleCalendarId,
      accessToken,
      refreshToken,
      tokenExpiresAt: new Date(tokenExpiresAt),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ connection_id: result.value.connectionId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
