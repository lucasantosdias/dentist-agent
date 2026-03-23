import { NextResponse } from "next/server";

import { getEnv } from "@/config/env";
import { inboundMessageSchema } from "@/modules/conversations/adapters/inboundMessageSchema";
import { getContainer } from "@/server/container";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const parsed = inboundMessageSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_request",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const env = getEnv();
    const clinicId = parsed.data.clinic_id ?? env.DEFAULT_CLINIC_ID;

    const container = getContainer();
    const output = await container.conversationOrchestrator.execute(clinicId, parsed.data);

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";

    return NextResponse.json(
      {
        error: "internal_error",
        message,
      },
      { status: 500 },
    );
  }
}
