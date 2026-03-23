import type { ClinicRepositoryPort } from "@/modules/clinic/application/ports/ClinicRepositoryPort";
import type { Clinic } from "@/modules/clinic/domain/Clinic";

export class ListClinicsUseCase {
  constructor(private readonly clinicRepository: ClinicRepositoryPort) {}

  async execute(): Promise<Clinic[]> {
    return this.clinicRepository.listActive();
  }
}
