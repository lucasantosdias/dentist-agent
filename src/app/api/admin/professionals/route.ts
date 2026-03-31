import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getEnv } from "@/config/env";
import { prisma } from "@/server/db/prisma";
import { PrismaCatalogRepository } from "@/modules/catalog/infrastructure/PrismaCatalogRepository";

// POST /api/admin/professionals — Register a new professional and link to a clinic
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      display_name: snakeDisplayName, displayName: camelDisplayName,
      specialty_ids: snakeSpecialtyIds, specialtyIds: camelSpecialtyIds,
      email, phone, timezone,
      clinic_id: snakeClinicId, clinicId: camelClinicId,
      service_ids: snakeServiceIds, serviceIds: camelServiceIds,
      role,
    } = body as {
      display_name?: string;
      displayName?: string;
      specialty_ids?: string[];
      specialtyIds?: string[];
      email?: string;
      phone?: string;
      timezone?: string;
      clinic_id?: string;
      clinicId?: string;
      service_ids?: string[];
      serviceIds?: string[];
      role?: string;
    };

    const displayName = snakeDisplayName ?? camelDisplayName;
    const specialtyIds = snakeSpecialtyIds ?? camelSpecialtyIds;
    const serviceIds = snakeServiceIds ?? camelServiceIds;
    const env = getEnv();
    const clinicId = snakeClinicId ?? camelClinicId ?? env.DEFAULT_CLINIC_ID;

    if (!displayName) {
      return NextResponse.json({ error: "display_name is required" }, { status: 400 });
    }

    const repo = new PrismaCatalogRepository(prisma);

    // Atomic: create professional + clinic link + service links in a single transaction
    const professional = await prisma.$transaction(async (tx) => {
      const txRepo = new PrismaCatalogRepository(tx as typeof prisma);

      const prof = await txRepo.createProfessional({
        displayName,
        specialtyIds: specialtyIds ?? [],
        email: email ?? null,
        phone: phone ?? null,
        timezone: timezone ?? "America/Sao_Paulo",
      });

      await tx.clinicProfessional.upsert({
        where: {
          clinicId_professionalId: { clinicId, professionalId: prof.id },
        },
        update: { active: true, role: role === "CLINIC_MANAGER" ? "CLINIC_MANAGER" : "PROFESSIONAL" },
        create: {
          clinicId,
          professionalId: prof.id,
          role: role === "CLINIC_MANAGER" ? "CLINIC_MANAGER" : "PROFESSIONAL",
        },
      });

      if (serviceIds?.length) {
        for (const serviceId of serviceIds) {
          await txRepo.addProfessionalService(prof.id, serviceId);
        }
      }

      return prof;
    });

    return NextResponse.json({
      id: professional.id,
      display_name: professional.displayName,
      specialties: professional.specialties,
      email: professional.email,
      phone: professional.phone,
      timezone: professional.timezone,
      active: professional.active,
      clinic_id: clinicId,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Professional with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/admin/professionals — List all professionals
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const env = getEnv();
    const clinicId = request.nextUrl.searchParams.get("clinic_id") ?? env.DEFAULT_CLINIC_ID;
    const repo = new PrismaCatalogRepository(prisma);
    const professionals = await repo.listActiveProfessionals(clinicId);

    return NextResponse.json(
      professionals.map((p) => ({
        id: p.id,
        display_name: p.displayName,
        specialties: p.specialties,
        email: p.email,
        phone: p.phone,
        timezone: p.timezone,
        active: p.active,
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/admin/professionals]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
