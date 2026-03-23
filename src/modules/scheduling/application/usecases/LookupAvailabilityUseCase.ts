import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import { ProposeSlotsUseCase } from "@/modules/scheduling/application/usecases/ProposeSlotsUseCase";
import type { SchedulingPolicies } from "@/modules/scheduling/domain/SchedulingPolicies";
import type { TimeSlot } from "@/modules/scheduling/application/dto/SchedulingDtos";

/**
 * Consolidated availability lookup.
 *
 * Given a service and an optional target date, finds available slots for
 * ALL professionals who can perform that service. Returns results grouped
 * by professional so the patient can pick professional + time in one step.
 *
 * Two modes:
 * 1. Target date provided (date-only): show all slots on that day per professional
 * 2. No target date: forward-search from tomorrow, find the earliest slot per professional
 */

export type ProfessionalAvailability = {
  professionalId: string;
  professionalName: string;
  slots: TimeSlot[];
};

export type LookupAvailabilityInput = {
  clinicId: string;
  serviceId: string;
  serviceDurationMin: number;
  targetDate: Date | null;
  now: Date;
  maxSlotsPerProfessional?: number;
  maxForwardDays?: number;
};

export type LookupAvailabilityResult = {
  availability: ProfessionalAvailability[];
  searchedDate: Date | null;
};

export class LookupAvailabilityUseCase {
  constructor(
    private readonly catalogRepository: CatalogRepositoryPort,
    private readonly proposeSlotsUseCase: ProposeSlotsUseCase,
    private readonly policies: SchedulingPolicies,
  ) {}

  async execute(input: LookupAvailabilityInput): Promise<LookupAvailabilityResult> {
    const professionals = await this.catalogRepository.listActiveProfessionalsForService(
      input.clinicId,
      input.serviceId,
    );

    if (professionals.length === 0) {
      return { availability: [], searchedDate: null };
    }

    const maxSlots = input.maxSlotsPerProfessional ?? 3;

    // Mode 1: Target date provided — show all slots on that day
    if (input.targetDate) {
      return this.lookupForDate(professionals, input, maxSlots);
    }

    // Mode 2: No date — forward-search from tomorrow
    return this.forwardSearch(professionals, input, maxSlots);
  }

  private async lookupForDate(
    professionals: Array<{ id: string; name: string }>,
    input: LookupAvailabilityInput,
    maxSlots: number,
  ): Promise<LookupAvailabilityResult> {
    const availability: ProfessionalAvailability[] = [];

    for (const prof of professionals) {
      const slots = await this.proposeSlotsUseCase.execute({
        professionalId: prof.id,
        serviceDurationMin: input.serviceDurationMin,
        requestedStartsAt: input.targetDate,
        now: input.now,
        limit: maxSlots,
      });

      if (slots.length > 0) {
        availability.push({
          professionalId: prof.id,
          professionalName: prof.name,
          slots,
        });
      }
    }

    return { availability, searchedDate: input.targetDate };
  }

  private async forwardSearch(
    professionals: Array<{ id: string; name: string }>,
    input: LookupAvailabilityInput,
    maxSlots: number,
  ): Promise<LookupAvailabilityResult> {
    const maxDays = input.maxForwardDays ?? 14;
    const availability: ProfessionalAvailability[] = [];

    // Start from tomorrow's working hour start
    const tomorrow = new Date(input.now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(this.policies.workingHourStart, 0, 0, 0);

    // For each professional, find their earliest available slot within maxDays
    for (const prof of professionals) {
      let foundSlot: TimeSlot | null = null;

      for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
        const searchDate = new Date(tomorrow);
        searchDate.setDate(searchDate.getDate() + dayOffset);

        const slots = await this.proposeSlotsUseCase.execute({
          professionalId: prof.id,
          serviceDurationMin: input.serviceDurationMin,
          requestedStartsAt: searchDate,
          now: input.now,
          limit: 1,
        });

        if (slots.length > 0) {
          foundSlot = slots[0];
          break;
        }
      }

      if (foundSlot) {
        availability.push({
          professionalId: prof.id,
          professionalName: prof.name,
          slots: [foundSlot],
        });
      }
    }

    // Sort by earliest slot
    availability.sort((a, b) =>
      a.slots[0].startsAt.getTime() - b.slots[0].startsAt.getTime(),
    );

    return { availability, searchedDate: null };
  }
}
