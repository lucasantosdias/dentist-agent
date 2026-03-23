import type { PatientRepositoryPort } from "@/modules/patients/application/ports/PatientRepositoryPort";
import type { Patient } from "@/modules/patients/domain/Patient";

export class GetOrCreatePatientUseCase {
  constructor(private readonly patientRepository: PatientRepositoryPort) {}

  async execute(input: { clinicId: string; channel: string; externalUserId: string }): Promise<Patient> {
    const existing = await this.patientRepository.findByChannelAndExternalUser(
      input.clinicId,
      input.channel,
      input.externalUserId,
    );

    if (existing) {
      return existing;
    }

    return this.patientRepository.create(input.clinicId, input.channel, input.externalUserId);
  }
}
