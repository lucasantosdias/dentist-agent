import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getEnv } from "@/config/env";
import { prisma } from "@/server/db/prisma";
import { PrismaCatalogRepository } from "@/modules/catalog/infrastructure/PrismaCatalogRepository";

// POST /api/admin/professionals — Register a new professional
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      display_name: snakeDisplayName, displayName: camelDisplayName,
      email, phone, timezone,
      service_ids: snakeServiceIds, serviceIds: camelServiceIds,
    } = body as {
      display_name?: string;
      displayName?: string;
      email?: string;
      phone?: string;
      timezone?: string;
      service_ids?: string[];
      serviceIds?: string[];
    };

    const displayName = snakeDisplayName ?? camelDisplayName;
    const serviceIds = snakeServiceIds ?? camelServiceIds;

    if (!displayName) {
      return NextResponse.json({ error: "display_name is required" }, { status: 400 });
    }

    const repo = new PrismaCatalogRepository(prisma);

    const professional = await repo.createProfessional({
      displayName,
      email: email ?? null,
      phone: phone ?? null,
      timezone: timezone ?? "America/Sao_Paulo",
    });

    // Link services if provided
    if (serviceIds?.length) {
      for (const serviceId of serviceIds) {
        await repo.addProfessionalService(professional.id, serviceId);
      }
    }

    return NextResponse.json({
      id: professional.id,
      display_name: professional.displayName,
      email: professional.email,
      phone: professional.phone,
      timezone: professional.timezone,
      active: professional.active,
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
