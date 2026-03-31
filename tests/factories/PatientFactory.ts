import { Patient, type PatientProps } from "@/modules/patients/domain/Patient";
import type { PatientState } from "@/modules/patients/domain/PatientState";
import { randomUUID } from "crypto";

type PatientOverrides = Partial<PatientProps>;

export function buildPatient(overrides: PatientOverrides = {}): Patient {
  return new Patient({
    id: overrides.id ?? randomUUID(),
    clinicId: overrides.clinicId ?? "00000000-0000-0000-0000-000000000001",
    externalUserId: overrides.externalUserId ?? "user-" + randomUUID().slice(0, 8),
    defaultChannel: overrides.defaultChannel ?? "sim",
    fullName: overrides.fullName ?? null,
    cpf: overrides.cpf ?? null,
    phoneE164: overrides.phoneE164 ?? null,
    birthDate: overrides.birthDate ?? null,
    state: overrides.state ?? "LEAD_NEW",
    lastInteractionAt: overrides.lastInteractionAt ?? null,
  });
}

export function buildKnownPatient(overrides: PatientOverrides = {}): Patient {
  return buildPatient({
    fullName: "Lucas Silva",
    state: "LEAD_QUALIFIED" as PatientState,
    ...overrides,
  });
}

export function buildActivePatient(overrides: PatientOverrides = {}): Patient {
  return buildPatient({
    fullName: "Lucas Silva",
    state: "ACTIVE" as PatientState,
    ...overrides,
  });
}
