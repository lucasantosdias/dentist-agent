import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";

export type CatalogSnapshot = {
  services: Array<{ id: string; service_code: string; name: string; duration_min: number }>;
  professionals: Array<{ id: string; name: string }>;
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
        id: service.id,
        service_code: service.serviceCode,
        name: service.name,
        duration_min: service.durationMin,
      })),
      professionals: professionals.map((professional) => ({
        id: professional.id,
        name: professional.name,
      })),
    };
  }
}
