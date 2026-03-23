import type {
  AvailabilityRuleRepositoryPort,
  CreateAvailabilityRuleInput,
} from "@/modules/scheduling/application/ports/AvailabilityRuleRepositoryPort";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { AvailabilityRule } from "@/modules/scheduling/domain/AvailabilityRule";
import type { Result } from "@/shared/result";
import { ok, fail } from "@/shared/result";

export type CreateAvailabilityRuleError = "PROFESSIONAL_NOT_FOUND" | "INVALID_RULE";

export class CreateAvailabilityRuleUseCase {
  constructor(
    private readonly ruleRepo: AvailabilityRuleRepositoryPort,
    private readonly catalogRepo: CatalogRepositoryPort,
  ) {}

  async execute(
    input: CreateAvailabilityRuleInput,
  ): Promise<Result<AvailabilityRule, CreateAvailabilityRuleError>> {
    const professional = await this.catalogRepo.findProfessionalById(input.professionalId);
    if (!professional) return fail("PROFESSIONAL_NOT_FOUND");

    try {
      const rule = await this.ruleRepo.create(input);
      return ok(rule);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid")) {
        return fail("INVALID_RULE");
      }
      throw error;
    }
  }
}
