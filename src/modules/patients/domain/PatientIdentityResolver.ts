import type { Patient } from "@/modules/patients/domain/Patient";
import type { PatientState } from "@/modules/patients/domain/PatientState";

export type CanonicalPatientResult = {
  canonicalPatientId: string;
  allPatientIds: string[];
};

/**
 * Priority for selecting the canonical patient when duplicates exist.
 * Higher index = higher priority.
 */
const STATE_PRIORITY: Record<PatientState, number> = {
  INACTIVE: 0,
  LEAD_INACTIVE: 1,
  LEAD_NEW: 2,
  LEAD_QUALIFIED: 3,
  ACTIVE: 4,
};

/**
 * Given a list of patient records (potentially duplicates with same CPF),
 * determine which is the canonical record.
 *
 * Priority: ACTIVE > LEAD_QUALIFIED > LEAD_NEW > others
 * Tie-break: most recent interaction.
 */
export function resolveCanonicalPatient(patients: Patient[]): CanonicalPatientResult | null {
  if (patients.length === 0) return null;

  if (patients.length === 1) {
    return {
      canonicalPatientId: patients[0].id,
      allPatientIds: [patients[0].id],
    };
  }

  // Sort by state priority (desc), then by lastInteractionAt (desc)
  const sorted = [...patients].sort((a, b) => {
    const priorityDiff = STATE_PRIORITY[b.state] - STATE_PRIORITY[a.state];
    if (priorityDiff !== 0) return priorityDiff;

    const aTime = a.lastInteractionAt?.getTime() ?? 0;
    const bTime = b.lastInteractionAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return {
    canonicalPatientId: sorted[0].id,
    allPatientIds: sorted.map((p) => p.id),
  };
}
