import type { ClinicRepositoryPort } from "@/modules/clinic/application/ports/ClinicRepositoryPort";

export type AddProfessionalToClinicInput = {
  clinicId: string;
  professionalId: string;
  role?: string;
};

export class AddProfessionalToClinicUseCase {
  constructor(private readonly clinicRepository: ClinicRepositoryPort) {}

  async execute(input: AddProfessionalToClinicInput): Promise<void> {
    const clinic = await this.clinicRepository.findById(input.clinicId);
    if (!clinic) {
      throw new Error(`Clinic not found: ${input.clinicId}`);
    }

    await this.clinicRepository.addProfessional(
      input.clinicId,
      input.professionalId,
      input.role,
    );
  }
}
