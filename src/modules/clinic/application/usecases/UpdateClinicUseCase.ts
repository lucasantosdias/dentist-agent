import type { ClinicRepositoryPort } from "@/modules/clinic/application/ports/ClinicRepositoryPort";
import type { Clinic } from "@/modules/clinic/domain/Clinic";

export type UpdateClinicInput = {
  clinicId: string;
  name?: string;
  legalName?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export class UpdateClinicUseCase {
  constructor(private readonly clinicRepository: ClinicRepositoryPort) {}

  async execute(input: UpdateClinicInput): Promise<Clinic> {
    const clinic = await this.clinicRepository.findById(input.clinicId);
    if (!clinic) {
      throw new Error(`Clinic not found: ${input.clinicId}`);
    }

    clinic.update({
      name: input.name,
      legalName: input.legalName,
      document: input.document,
      phone: input.phone,
      email: input.email,
      address: input.address,
    });

    return this.clinicRepository.save(clinic);
  }
}
