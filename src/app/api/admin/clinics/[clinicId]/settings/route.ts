import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ clinicId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { clinicId } = await context.params;

    const [settings, specialties] = await Promise.all([
      prisma.clinicSettings.findUnique({ where: { clinicId } }),
      prisma.specialty.findMany({
        where: { clinicId, active: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      specialties: specialties.map((s) => ({ id: s.id, name: s.name })),
      bot_name: settings?.botName ?? null,
      clinic_display_name: settings?.clinicDisplayName ?? null,
      tone: settings?.tone ?? null,
      working_hour_start: settings?.workingHourStart ?? null,
      working_hour_end: settings?.workingHourEnd ?? null,
      working_days_text: settings?.workingDaysText ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/clinics/[clinicId]/settings]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
