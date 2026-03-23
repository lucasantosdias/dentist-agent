import { NextResponse } from "next/server";
import { getContainer } from "@/server/container";

/**
 * POST /api/admin/outbox/process — Process pending calendar outbox events
 *
 * Creates Google Calendar events for confirmed appointments.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const container = getContainer();

    if (!container.processCalendarOutboxUseCase) {
      return NextResponse.json(
        { error: "Google Calendar integration is not configured" },
        { status: 501 },
      );
    }

    const result = await container.processCalendarOutboxUseCase.execute();

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
