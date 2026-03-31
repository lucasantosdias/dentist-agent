export const appointmentStatuses = [
  "PENDING",
  "CONFIRMED",
  "RESCHEDULED",
  "CANCELLED",
  "NO_SHOW",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export const cancelledByValues = ["PACIENTE", "BOT", "HUMANO", "SISTEMA"] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];
export type CancelledBy = (typeof cancelledByValues)[number];

// ─── Status Transition Rules ────────────────────────────────

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, ReadonlySet<AppointmentStatus>> = {
  PENDING:     new Set(["CONFIRMED", "CANCELLED"]),
  CONFIRMED:   new Set(["RESCHEDULED", "CANCELLED", "NO_SHOW", "IN_PROGRESS"]),
  RESCHEDULED: new Set([]),  // terminal — history marker
  CANCELLED:   new Set([]),  // terminal
  NO_SHOW:     new Set([]),  // terminal
  IN_PROGRESS: new Set(["COMPLETED"]),
  COMPLETED:   new Set([]),  // terminal
};

/**
 * Check whether a status transition is allowed by business rules.
 */
export function isValidAppointmentTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].has(to);
}

/**
 * Terminal statuses — no further transitions allowed.
 */
export const TERMINAL_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  "RESCHEDULED",
  "CANCELLED",
  "NO_SHOW",
  "COMPLETED",
]);

/**
 * Statuses that represent active/upcoming appointments.
 */
export const ACTIVE_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  "PENDING",
  "CONFIRMED",
]);
