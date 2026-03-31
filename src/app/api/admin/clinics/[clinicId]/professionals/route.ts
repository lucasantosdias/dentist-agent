import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ clinicId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { clinicId } = await context.params;

    const clinicProfessionals = await prisma.clinicProfessional.findMany({
      where: { clinicId, active: true },
      include: {
        professional: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
            timezone: true,
            active: true,
            professionalSpecialties: {
              include: { specialty: { select: { name: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json(
      clinicProfessionals.map((cp) => ({
        id: cp.professional.id,
        display_name: cp.professional.displayName,
        specialties: cp.professional.professionalSpecialties.map(
          (ps) => ps.specialty.name,
        ),
        email: cp.professional.email,
        phone: cp.professional.phone,
        timezone: cp.professional.timezone,
        active: cp.professional.active,
        role: cp.role,
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/clinics/[clinicId]/professionals]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
