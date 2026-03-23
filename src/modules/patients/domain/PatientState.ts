export const patientStates = [
  "LEAD_NEW",
  "LEAD_QUALIFIED",
  "LEAD_INACTIVE",
  "ACTIVE",
  "INACTIVE",
] as const;

export type PatientState = (typeof patientStates)[number];
