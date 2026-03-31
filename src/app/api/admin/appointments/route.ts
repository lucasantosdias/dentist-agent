import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getContainer } from "@/server/container";
import { PrismaCatalogRepository } from "@/modules/catalog/infrastructure/PrismaCatalogRepository";
import { PrismaAppointmentRepository } from "@/modules/scheduling/infrastructure/PrismaAppointmentRepository";
import { PrismaSchedulingAvailability } from "@/modules/scheduling/infrastructure/PrismaSchedulingAvailability";
import { toIsoWithTimezone } from "@/shared/time";

/**
 * POST /api/admin/appointments — Book an appointment directly
 *
 * Flow:
 * 1. Validate professional can perform service
 * 2. Check platform availability (appointments + holds)
 * 3. Check Google Calendar free/busy (if connected)
 * 4. Create the appointment
 * 5. Enqueue calendar outbox event
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      clinic_id: snakeClinicId, clinicId: camelClinicId,
      patient_id: snakePatientId, patientId: camelPatientId,
      professional_id: snakeProfessionalId, professionalId: camelProfessionalId,
      service_code: snakeServiceCode, serviceCode: camelServiceCode,
      starts_at: snakeStartsAt, startsAt: camelStartsAt,
      patient_name: snakePatientName, patientName: camelPatientName,
    } = body as Record<string, string | undefined>;

    const bodyClinicId = snakeClinicId ?? camelClinicId;
    const patientId = snakePatientId ?? camelPatientId;
    const professionalId = snakeProfessionalId ?? camelProfessionalId;
    const serviceCode = snakeServiceCode ?? camelServiceCode;
    const startsAtStr = snakeStartsAt ?? camelStartsAt;
    const patientName = snakePatientName ?? camelPatientName;

    if (!patientId || !professionalId || !serviceCode || !startsAtStr) {
      return NextResponse.json(
        { error: "patient_id, professional_id, service_code, and starts_at are required" },
        { status: 400 },
      );
    }

    const catalogRepo = new PrismaCatalogRepository(prisma);
    const { getEnv } = await import("@/config/env");
    const env = getEnv();
    const clinicId = bodyClinicId ?? env.DEFAULT_CLINIC_ID;
    const availabilityPort = new PrismaSchedulingAvailability(prisma, env.APP_UTC_OFFSET_MINUTES);
    const appointmentRepo = new PrismaAppointmentRepository(prisma);

    // 1. Validate service and professional
    const service = await catalogRepo.findServiceByCode(clinicId, serviceCode);
    if (!service) {
      return NextResponse.json({ error: `Service not found: ${serviceCode}` }, { status: 404 });
    }

    const professional = await catalogRepo.findProfessionalById(professionalId);
    if (!professional) {
      return NextResponse.json({ error: "Professional not found" }, { status: 404 });
    }

    const canPerform = await catalogRepo.professionalCanExecuteService(professionalId, service.id);
    if (!canPerform) {
      return NextResponse.json(
        { error: `${professional.displayName} does not perform ${serviceCode}` },
        { status: 400 },
      );
    }

    // 2. Calculate slot
    const startsAt = new Date(startsAtStr);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    const now = new Date();

    if (startsAt <= now) {
      return NextResponse.json({ error: "Cannot book a slot in the past" }, { status: 400 });
    }

    // 3. Check platform availability (appointments + holds)
    const platformAvailable = await availabilityPort.isSlotAvailable({
      professionalId,
      startsAt,
      endsAt,
      now,
    });

    if (!platformAvailable) {
      return NextResponse.json(
        { error: "Slot is not available (conflicting appointment or hold)" },
        { status: 409 },
      );
    }

    // 4. Check Google Calendar free/busy
    const container = getContainer();
    if (container.checkGoogleCalendarFreeBusyUseCase) {
      const freeBusy = await container.checkGoogleCalendarFreeBusyUseCase.execute({
        professionalId,
        timeMin: startsAt,
        timeMax: endsAt,
      });

      if (!freeBusy.available) {
        return NextResponse.json(
          { error: "Slot conflicts with doctor's Google Calendar" },
          { status: 409 },
        );
      }
    }

    // 5. Create appointment
    const appointment = await appointmentRepo.create({
      clinicId,
      patientId,
      professionalId,
      serviceId: service.id,
      startsAt,
      endsAt,
      status: "CONFIRMED",
      createdBy: "ADMIN_API",
    });

    // 6. Enqueue outbox for Google Calendar event creation
    const { PrismaOutboxRepository } = await import(
      "@/modules/integration/infrastructure/PrismaOutboxRepository"
    );
    const outboxRepo = new PrismaOutboxRepository(prisma);
    await outboxRepo.createPending({
      appointmentId: appointment.id,
      aggregateType: "APPOINTMENT",
      action: "CREATE_EVENT",
      payload: {
        patient_name: patientName ?? "Paciente",
        professional_name: professional.displayName,
        service_name: service.displayName,
        service_code: service.code,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      },
    });

    return NextResponse.json({
      id: appointment.id,
      status: appointment.status,
      professional: professional.displayName,
      service: service.code,
      starts_at: toIsoWithTimezone(startsAt),
      ends_at: toIsoWithTimezone(endsAt),
      starts_at_utc: startsAt.toISOString(),
      ends_at_utc: endsAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
