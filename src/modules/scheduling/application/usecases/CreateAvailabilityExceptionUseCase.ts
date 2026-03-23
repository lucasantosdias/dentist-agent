import type {
  AvailabilityExceptionRepositoryPort,
  CreateAvailabilityExceptionInput,
} from "@/modules/scheduling/application/ports/AvailabilityExceptionRepositoryPort";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { AvailabilityException } from "@/modules/scheduling/domain/AvailabilityException";
import type { Result } from "@/shared/result";
import { ok, fail } from "@/shared/result";

export type CreateAvailabilityExceptionError = "PROFESSIONAL_NOT_FOUND" | "INVALID_RANGE";

export class CreateAvailabilityExceptionUseCase {
  constructor(
    private readonly exceptionRepo: AvailabilityExceptionRepositoryPort,
    private readonly catalogRepo: CatalogRepositoryPort,
  ) {}

  async execute(
    input: CreateAvailabilityExceptionInput,
  ): Promise<Result<AvailabilityException, CreateAvailabilityExceptionError>> {
    const professional = await this.catalogRepo.findProfessionalById(input.professionalId);
    if (!professional) return fail("PROFESSIONAL_NOT_FOUND");

    if (input.endsAt <= input.startsAt) return fail("INVALID_RANGE");

    const exception = await this.exceptionRepo.create(input);
    return ok(exception);
  }
}
