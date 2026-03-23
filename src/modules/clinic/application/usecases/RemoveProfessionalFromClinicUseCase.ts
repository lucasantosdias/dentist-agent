import type { ClinicRepositoryPort } from "@/modules/clinic/application/ports/ClinicRepositoryPort";

export type RemoveProfessionalFromClinicInput = {
  clinicId: string;
  professionalId: string;
};

export class RemoveProfessionalFromClinicUseCase {
  constructor(private readonly clinicRepository: ClinicRepositoryPort) {}

  async execute(input: RemoveProfessionalFromClinicInput): Promise<void> {
    const clinic = await this.clinicRepository.findById(input.clinicId);
    if (!clinic) {
      throw new Error(`Clinic not found: ${input.clinicId}`);
    }

    await this.clinicRepository.removeProfessional(input.clinicId, input.professionalId);
  }
}
