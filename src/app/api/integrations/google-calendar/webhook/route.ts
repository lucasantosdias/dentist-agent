import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainer } from "@/server/container";

/**
 * Google Calendar push notification webhook.
 * Google sends a POST with channel ID and resource ID in headers.
 * We must respond 200 quickly, then process async.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceId = request.headers.get("x-goog-resource-id");
  const resourceState = request.headers.get("x-goog-resource-state");

  if (!channelId || !resourceId) {
    return NextResponse.json({ error: "Missing channel headers" }, { status: 400 });
  }

  // "sync" state is the initial verification — just acknowledge
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  // Process asynchronously — don't block the webhook response
  const container = getContainer();
  if (container.processCalendarWebhookUseCase) {
    container.processCalendarWebhookUseCase
      .execute({ channelId, resourceId })
      .catch((err) => console.error("Webhook processing failed:", err));
  }

  return NextResponse.json({ ok: true });
}
