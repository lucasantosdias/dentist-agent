import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id: professionalId } = await context.params;
    const body = await request.json();
    const {
      display_name: snakeDisplayName, displayName: camelDisplayName,
      email, phone, timezone, role, active,
      clinic_id: snakeClinicId, clinicId: camelClinicId,
      specialty_ids: snakeSpecialtyIds, specialtyIds: camelSpecialtyIds,
    } = body as {
      display_name?: string; displayName?: string;
      email?: string; phone?: string; timezone?: string;
      role?: string; active?: boolean;
      clinic_id?: string; clinicId?: string;
      specialty_ids?: string[]; specialtyIds?: string[];
    };

    const displayName = snakeDisplayName ?? camelDisplayName;
    const clinicId = snakeClinicId ?? camelClinicId;
    const specialtyIds = snakeSpecialtyIds ?? camelSpecialtyIds;

    // Check professional exists
    const existing = await prisma.professional.findUnique({
      where: { id: professionalId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Professional not found" }, { status: 404 });
    }

    // Update all fields atomically
    await prisma.$transaction(async (tx) => {
      await tx.professional.update({
        where: { id: professionalId },
        data: {
          ...(displayName !== undefined && { displayName }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(timezone !== undefined && { timezone }),
          ...(active !== undefined && { active }),
        },
      });

      if (specialtyIds !== undefined) {
        await tx.professionalSpecialty.deleteMany({
          where: { professionalId },
        });
        if (specialtyIds.length > 0) {
          await tx.professionalSpecialty.createMany({
            data: specialtyIds.map((specialtyId) => ({
              professionalId,
              specialtyId,
            })),
          });
        }
      }

      if (role !== undefined && clinicId) {
        await tx.clinicProfessional.update({
          where: {
            clinicId_professionalId: { clinicId, professionalId },
          },
          data: { role: role === "CLINIC_MANAGER" ? "CLINIC_MANAGER" : "PROFESSIONAL" },
        });
      }
    });

    // Re-fetch to get updated specialties
    const refreshed = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: {
        professionalSpecialties: { include: { specialty: true } },
      },
    });

    return NextResponse.json({
      id: refreshed!.id,
      display_name: refreshed!.displayName,
      specialties: refreshed!.professionalSpecialties.map((ps) => ps.specialty.name),
      email: refreshed!.email,
      phone: refreshed!.phone,
      timezone: refreshed!.timezone,
      active: refreshed!.active,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
