import type {
  ClinicRepositoryPort,
  CreateClinicInput,
} from "@/modules/clinic/application/ports/ClinicRepositoryPort";
import type { Clinic } from "@/modules/clinic/domain/Clinic";

export class CreateClinicUseCase {
  constructor(private readonly clinicRepository: ClinicRepositoryPort) {}

  async execute(input: CreateClinicInput): Promise<Clinic> {
    const existing = await this.clinicRepository.findBySlug(input.slug);
    if (existing) {
      throw new Error(`Clinic with slug "${input.slug}" already exists`);
    }

    return this.clinicRepository.create(input);
  }
}
