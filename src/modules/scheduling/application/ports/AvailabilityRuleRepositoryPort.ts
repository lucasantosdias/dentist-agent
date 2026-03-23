import type { AvailabilityRule } from "@/modules/scheduling/domain/AvailabilityRule";

export type CreateAvailabilityRuleInput = {
  professionalId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number | null;
  locationId?: string | null;
};

export interface AvailabilityRuleRepositoryPort {
  create(input: CreateAvailabilityRuleInput): Promise<AvailabilityRule>;
  findByProfessionalAndWeekday(professionalId: string, weekday: number): Promise<AvailabilityRule[]>;
  findByProfessional(professionalId: string): Promise<AvailabilityRule[]>;
  delete(id: string): Promise<void>;
}
