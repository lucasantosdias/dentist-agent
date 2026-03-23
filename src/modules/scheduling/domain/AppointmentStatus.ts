export const appointmentStatuses = [
  "AGENDADA",
  "CONFIRMADA",
  "CANCELADA",
  "NO_SHOW",
  "COMPARECEU",
] as const;

export const cancelledByValues = ["PACIENTE", "BOT", "HUMANO", "SISTEMA"] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];
export type CancelledBy = (typeof cancelledByValues)[number];
