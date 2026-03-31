import { Appointment } from "@/modules/scheduling/domain/Appointment";
import {
  isValidAppointmentTransition,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  type AppointmentStatus,
} from "@/modules/scheduling/domain/AppointmentStatus";

function makeAppointment(overrides: Partial<import("@/modules/scheduling/domain/Appointment").AppointmentProps> = {}): Appointment {
  const futureDate = new Date(Date.now() + 24 * 60 * 60_000);
  return new Appointment({
    id: "apt-1",
    patientId: "patient-1",
    conversationId: "conv-1",
    serviceId: "service-1",
    professionalId: "prof-1",
    startsAt: futureDate,
    endsAt: new Date(futureDate.getTime() + 30 * 60_000),
    status: "CONFIRMED",
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    createdBy: "BOT",
    ...overrides,
  });
}

describe("AppointmentStatus transitions", () => {
  describe("isValidAppointmentTransition", () => {
    const VALID_TRANSITIONS: [AppointmentStatus, AppointmentStatus][] = [
      ["PENDING", "CONFIRMED"],
      ["PENDING", "CANCELLED"],
      ["CONFIRMED", "RESCHEDULED"],
      ["CONFIRMED", "CANCELLED"],
      ["CONFIRMED", "NO_SHOW"],
      ["CONFIRMED", "IN_PROGRESS"],
      ["IN_PROGRESS", "COMPLETED"],
    ];

    it.each(VALID_TRANSITIONS)("%s → %s is allowed", (from, to) => {
      expect(isValidAppointmentTransition(from, to)).toBe(true);
    });

    const INVALID_TRANSITIONS: [AppointmentStatus, AppointmentStatus][] = [
      ["COMPLETED", "CONFIRMED"],
      ["COMPLETED", "IN_PROGRESS"],
      ["NO_SHOW", "CONFIRMED"],
      ["NO_SHOW", "IN_PROGRESS"],
      ["CANCELLED", "CONFIRMED"],
      ["CANCELLED", "PENDING"],
      ["RESCHEDULED", "CONFIRMED"],
      ["IN_PROGRESS", "CONFIRMED"],
      ["IN_PROGRESS", "CANCELLED"],
      ["PENDING", "COMPLETED"],
      ["PENDING", "IN_PROGRESS"],
      ["PENDING", "NO_SHOW"],
      ["CONFIRMED", "COMPLETED"],
      ["CONFIRMED", "PENDING"],
    ];

    it.each(INVALID_TRANSITIONS)("%s → %s is blocked", (from, to) => {
      expect(isValidAppointmentTransition(from, to)).toBe(false);
    });
  });

  describe("TERMINAL_STATUSES", () => {
    it("includes RESCHEDULED, CANCELLED, NO_SHOW, COMPLETED", () => {
      expect(TERMINAL_STATUSES.has("RESCHEDULED")).toBe(true);
      expect(TERMINAL_STATUSES.has("CANCELLED")).toBe(true);
      expect(TERMINAL_STATUSES.has("NO_SHOW")).toBe(true);
      expect(TERMINAL_STATUSES.has("COMPLETED")).toBe(true);
    });

    it("does not include PENDING, CONFIRMED, IN_PROGRESS", () => {
      expect(TERMINAL_STATUSES.has("PENDING")).toBe(false);
      expect(TERMINAL_STATUSES.has("CONFIRMED")).toBe(false);
      expect(TERMINAL_STATUSES.has("IN_PROGRESS")).toBe(false);
    });
  });

  describe("ACTIVE_STATUSES", () => {
    it("includes PENDING and CONFIRMED", () => {
      expect(ACTIVE_STATUSES.has("PENDING")).toBe(true);
      expect(ACTIVE_STATUSES.has("CONFIRMED")).toBe(true);
    });
  });
});

describe("Appointment domain model", () => {
  describe("Scheduling creation flow: PENDING → CONFIRMED", () => {
    it("transitions from PENDING to CONFIRMED", () => {
      const apt = makeAppointment({ status: "PENDING" });
      apt.confirm();
      expect(apt.status).toBe("CONFIRMED");
    });

    it("cannot confirm from CANCELLED", () => {
      const apt = makeAppointment({ status: "CANCELLED" });
      expect(() => apt.confirm()).toThrow("Invalid appointment transition");
    });
  });

  describe("Cancellation", () => {
    it("PENDING → CANCELLED", () => {
      const apt = makeAppointment({ status: "PENDING" });
      const now = new Date();
      apt.cancel("PACIENTE", "Changed my mind", now);
      expect(apt.status).toBe("CANCELLED");
      expect(apt.cancelledBy).toBe("PACIENTE");
      expect(apt.cancelledAt).toBe(now);
      expect(apt.cancellationReason).toBe("Changed my mind");
    });

    it("CONFIRMED → CANCELLED", () => {
      const apt = makeAppointment({ status: "CONFIRMED" });
      apt.cancel("PACIENTE", null, new Date());
      expect(apt.status).toBe("CANCELLED");
    });

    it("cancellation is idempotent", () => {
      const apt = makeAppointment({ status: "CANCELLED" });
      apt.cancel("HUMANO", "again", new Date());
      expect(apt.status).toBe("CANCELLED");
    });

    it("cannot cancel COMPLETED", () => {
      const apt = makeAppointment({ status: "COMPLETED" });
      expect(() => apt.cancel("SISTEMA", null, new Date())).toThrow();
    });
  });

  describe("Rescheduling: CONFIRMED → RESCHEDULED", () => {
    it("marks appointment as RESCHEDULED with history", () => {
      const apt = makeAppointment({ status: "CONFIRMED" });
      const now = new Date();
      apt.markRescheduled(now);
      expect(apt.status).toBe("RESCHEDULED");
      expect(apt.cancelledBy).toBe("SISTEMA");
      expect(apt.cancellationReason).toContain("Reagendamento");
    });

    it("cannot reschedule a CANCELLED appointment", () => {
      const apt = makeAppointment({ status: "CANCELLED" });
      expect(() => apt.markRescheduled(new Date())).toThrow();
    });
  });

  describe("Visit lifecycle: CONFIRMED → IN_PROGRESS → COMPLETED", () => {
    it("full visit flow", () => {
      const apt = makeAppointment({ status: "CONFIRMED" });
      apt.checkIn();
      expect(apt.status).toBe("IN_PROGRESS");
      apt.complete();
      expect(apt.status).toBe("COMPLETED");
    });

    it("cannot check in from PENDING", () => {
      const apt = makeAppointment({ status: "PENDING" });
      expect(() => apt.checkIn()).toThrow();
    });

    it("cannot complete without check-in", () => {
      const apt = makeAppointment({ status: "CONFIRMED" });
      expect(() => apt.complete()).toThrow();
    });
  });

  describe("NO_SHOW: CONFIRMED → NO_SHOW", () => {
    it("marks as NO_SHOW after scheduled time", () => {
      const pastStart = new Date(Date.now() - 60 * 60_000);
      const apt = makeAppointment({
        status: "CONFIRMED",
        startsAt: pastStart,
        endsAt: new Date(pastStart.getTime() + 30 * 60_000),
      });
      apt.markNoShow(new Date());
      expect(apt.status).toBe("NO_SHOW");
    });

    it("cannot mark NO_SHOW before scheduled time", () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60_000);
      const apt = makeAppointment({
        status: "CONFIRMED",
        startsAt: futureStart,
      });
      expect(() => apt.markNoShow(new Date())).toThrow(
        "Cannot mark NO_SHOW before scheduled start time",
      );
    });

    it("cannot mark NO_SHOW on CANCELLED appointment", () => {
      const apt = makeAppointment({ status: "CANCELLED" });
      expect(() => apt.markNoShow(new Date())).toThrow();
    });

    it("cannot mark NO_SHOW on COMPLETED appointment", () => {
      const apt = makeAppointment({ status: "COMPLETED" });
      expect(() => apt.markNoShow(new Date())).toThrow();
    });
  });
});
