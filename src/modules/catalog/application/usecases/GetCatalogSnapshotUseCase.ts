import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";

export type CatalogSnapshot = {
  services: Array<{ service_code: string; name: string; duration_min: number }>;
  professionals: Array<{ name: string }>;
};

export class GetCatalogSnapshotUseCase {
  constructor(private readonly catalogRepository: CatalogRepositoryPort) {}

  async execute(clinicId: string): Promise<CatalogSnapshot> {
    const [services, professionals] = await Promise.all([
      this.catalogRepository.listActiveServices(clinicId),
      this.catalogRepository.listActiveProfessionals(clinicId),
    ]);

    return {
      services: services.map((service) => ({
        service_code: service.serviceCode,
        name: service.name,
        duration_min: service.durationMin,
      })),
      professionals: professionals.map((professional) => ({ name: professional.name })),
    };
  }
}
