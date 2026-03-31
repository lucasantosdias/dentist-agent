import { Appointment } from "@/modules/scheduling/domain/Appointment";
import type { AppointmentStatus } from "@/modules/scheduling/domain/AppointmentStatus";
import { ProcessOverdueAppointmentsUseCase } from "@/modules/scheduling/application/usecases/ProcessOverdueAppointmentsUseCase";
import type { AppointmentRepositoryPort } from "@/modules/scheduling/application/ports/AppointmentRepositoryPort";

// ─── In-memory repository for testing ───────────────────────

class InMemoryAppointmentRepository implements AppointmentRepositoryPort {
  private appointments: Map<string, Appointment> = new Map();

  seed(apt: Appointment): void {
    this.appointments.set(apt.id, apt);
  }

  get(id: string): Appointment | undefined {
    return this.appointments.get(id);
  }

  async create(input: import("@/modules/scheduling/application/ports/AppointmentRepositoryPort").CreateAppointmentInput): Promise<Appointment> {
    const apt = new Appointment({
      id: `apt-${Date.now()}`,
      patientId: input.patientId,
      conversationId: input.conversationId ?? null,
      serviceId: input.serviceId,
      professionalId: input.professionalId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: input.status ?? "CONFIRMED",
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      createdBy: input.createdBy ?? "BOT",
    });
    this.appointments.set(apt.id, apt);
    return apt;
  }

  async save(appointment: Appointment): Promise<Appointment> {
    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  async listByPatientAndStatuses(
    patientId: string,
    statuses: AppointmentStatus[],
    fromDate?: Date,
  ): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter((a) => {
      if (a.patientId !== patientId) return false;
      if (!statuses.includes(a.status)) return false;
      if (fromDate && a.startsAt < fromDate) return false;
      return true;
    });
  }

  async listByPatientIdsAndStatuses(
    patientIds: string[],
    statuses: AppointmentStatus[],
    fromDate?: Date,
  ): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter((a) => {
      if (!patientIds.includes(a.patientId)) return false;
      if (!statuses.includes(a.status)) return false;
      if (fromDate && a.startsAt < fromDate) return false;
      return true;
    });
  }

  async listOverdueConfirmed(clinicId: string, cutoffTime: Date): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter((a) => {
      const props = a.toPrimitives();
      // We don't store clinicId in the domain model — use a convention for tests
      return a.status === "CONFIRMED" && a.startsAt < cutoffTime;
    });
  }
}

// ─── Helper ─────────────────────────────────────────────────

function makeAppointment(id: string, status: AppointmentStatus, startsAt: Date): Appointment {
  return new Appointment({
    id,
    patientId: "patient-1",
    conversationId: null,
    serviceId: "service-1",
    professionalId: "prof-1",
    startsAt,
    endsAt: new Date(startsAt.getTime() + 30 * 60_000),
    status,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    createdBy: "BOT",
  });
}

// ─── Tests ──────────────────────────────────────────────────

describe("ProcessOverdueAppointmentsUseCase", () => {
  let repo: InMemoryAppointmentRepository;
  let useCase: ProcessOverdueAppointmentsUseCase;
  const clinicId = "clinic-1";
  const graceMinutes = 30;

  beforeEach(() => {
    repo = new InMemoryAppointmentRepository();
    useCase = new ProcessOverdueAppointmentsUseCase(repo);
  });

  it("marks CONFIRMED appointment past grace period as NO_SHOW", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);
    repo.seed(makeAppointment("apt-1", "CONFIRMED", twoHoursAgo));

    const result = await useCase.execute({
      clinicId,
      now: new Date(),
      graceMinutes,
    });

    expect(result.processedCount).toBe(1);
    expect(result.appointmentIds).toContain("apt-1");
    expect(repo.get("apt-1")!.status).toBe("NO_SHOW");
  });

  it("does NOT affect future CONFIRMED appointments", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);
    repo.seed(makeAppointment("apt-future", "CONFIRMED", tomorrow));

    const result = await useCase.execute({
      clinicId,
      now: new Date(),
      graceMinutes,
    });

    expect(result.processedCount).toBe(0);
    expect(repo.get("apt-future")!.status).toBe("CONFIRMED");
  });

  it("does NOT affect CANCELLED appointments", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);
    repo.seed(makeAppointment("apt-cancelled", "CANCELLED", twoHoursAgo));

    const result = await useCase.execute({
      clinicId,
      now: new Date(),
      graceMinutes,
    });

    expect(result.processedCount).toBe(0);
    expect(repo.get("apt-cancelled")!.status).toBe("CANCELLED");
  });

  it("does NOT affect COMPLETED appointments", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);
    repo.seed(makeAppointment("apt-completed", "COMPLETED", twoHoursAgo));

    const result = await useCase.execute({
      clinicId,
      now: new Date(),
      graceMinutes,
    });

    expect(result.processedCount).toBe(0);
  });

  it("does NOT affect NO_SHOW appointments (idempotent)", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);
    repo.seed(makeAppointment("apt-noshow", "NO_SHOW", twoHoursAgo));

    const result = await useCase.execute({
      clinicId,
      now: new Date(),
      graceMinutes,
    });

    expect(result.processedCount).toBe(0);
  });

  it("respects grace period — does not mark appointments within grace window", async () => {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000);
    repo.seed(makeAppointment("apt-recent", "CONFIRMED", fifteenMinutesAgo));

    const result = await useCase.execute({
      clinicId,
      now: new Date(),
      graceMinutes: 30, // 30 min grace → 15 min ago is within grace
    });

    expect(result.processedCount).toBe(0);
    expect(repo.get("apt-recent")!.status).toBe("CONFIRMED");
  });

  it("processes multiple overdue appointments at once", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60_000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);

    repo.seed(makeAppointment("apt-a", "CONFIRMED", threeHoursAgo));
    repo.seed(makeAppointment("apt-b", "CONFIRMED", twoHoursAgo));

    const result = await useCase.execute({
      clinicId,
      now: new Date(),
      graceMinutes,
    });

    expect(result.processedCount).toBe(2);
    expect(repo.get("apt-a")!.status).toBe("NO_SHOW");
    expect(repo.get("apt-b")!.status).toBe("NO_SHOW");
  });

  it("is idempotent — running twice produces same result", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);
    repo.seed(makeAppointment("apt-1", "CONFIRMED", twoHoursAgo));

    const first = await useCase.execute({ clinicId, now: new Date(), graceMinutes });
    expect(first.processedCount).toBe(1);

    const second = await useCase.execute({ clinicId, now: new Date(), graceMinutes });
    expect(second.processedCount).toBe(0);
  });
});
