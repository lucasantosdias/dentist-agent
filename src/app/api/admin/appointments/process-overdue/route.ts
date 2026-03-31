import { NextResponse } from "next/server";
import { getContainer } from "@/server/container";

/**
 * POST /api/admin/appointments/process-overdue — Mark overdue appointments as NO_SHOW
 *
 * Designed to be called by a cron job or scheduler.
 * Processes all clinics or a specific clinic via query param.
 *
 * Query params:
 *   clinicId (optional) — scope to a single clinic
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get("clinicId");

    const container = getContainer();

    if (!clinicId) {
      return NextResponse.json(
        { error: "clinicId query parameter is required" },
        { status: 400 },
      );
    }

    const result = await container.processOverdueAppointmentsUseCase.execute({
      clinicId,
      now: new Date(),
      graceMinutes: container.noShowGraceMinutes,
    });

    return NextResponse.json({
      ok: true,
      processedCount: result.processedCount,
      appointmentIds: result.appointmentIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[ProcessOverdueRoute]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
