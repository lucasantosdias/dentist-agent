import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { Professional } from "@/modules/catalog/domain/Professional";
import type { Service } from "@/modules/catalog/domain/Service";
import type { SchedulingPolicies } from "@/modules/scheduling/domain/SchedulingPolicies";

export type StartSchedulingInput = {
  clinic_id: string;
  patient_known_name: string | null;
  entities: {
    full_name?: string | null;
    service_code?: string | null;
    professional_name?: string | null;
    datetime_iso?: string | null;
  };
  llm_missing: string[];
};

export type StartSchedulingOutput = {
  missing: string[];
  normalized: {
    full_name: string | null;
    service: Service | null;
    professional: Professional | null;
    starts_at: Date | null;
    ends_at: Date | null;
    /** The raw target date when date-only was provided (e.g., "amanhã" → midnight). */
    target_date: Date | null;
  };
  diagnostics: {
    datetime_provided: boolean;
    datetime_invalid: boolean;
    datetime_outside_working_hours: boolean;
    date_only_provided: boolean;
    service_provided: boolean;
    service_invalid: boolean;
    professional_provided: boolean;
    professional_invalid: boolean;
    professional_cannot_execute_service: boolean;
  };
};

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export class StartSchedulingUseCase {
  constructor(
    private readonly catalogRepository: CatalogRepositoryPort,
    private readonly policies: SchedulingPolicies,
  ) {}

  async execute(input: StartSchedulingInput): Promise<StartSchedulingOutput> {
    const missing = [...input.llm_missing];
    const diagnostics = {
      datetime_provided: Boolean(input.entities.datetime_iso),
      datetime_invalid: false,
      datetime_outside_working_hours: false,
      date_only_provided: false,
      service_provided: Boolean(input.entities.service_code),
      service_invalid: false,
      professional_provided: Boolean(input.entities.professional_name),
      professional_invalid: false,
      professional_cannot_execute_service: false,
    };

    const fullName = input.entities.full_name?.trim() || input.patient_known_name || null;
    if (!fullName) {
      missing.push("full_name");
    }

    let service: Service | null = null;
    if (input.entities.service_code) {
      service = await this.catalogRepository.findServiceByCode(input.clinic_id, input.entities.service_code.trim().toUpperCase());
      if (!service || !service.active) {
        missing.push("service_code");
        diagnostics.service_invalid = true;
        service = null;
      }
    } else {
      missing.push("service_code");
    }

    let professional: Professional | null = null;
    if (input.entities.professional_name) {
      professional = await this.catalogRepository.findProfessionalByName(input.clinic_id, input.entities.professional_name.trim());
      if (!professional || !professional.active) {
        missing.push("professional_name");
        diagnostics.professional_invalid = true;
        professional = null;
      }
    } else {
      missing.push("professional_name");
    }

    if (professional && service) {
      const canExecute = await this.catalogRepository.professionalCanExecuteService(
        professional.id,
        service.id,
      );
      if (!canExecute) {
        missing.push("professional_name");
        diagnostics.professional_cannot_execute_service = true;
        professional = null;
      }
    }

    let startsAt: Date | null = null;
    let endsAt: Date | null = null;

    const parsedStart = parseDate(input.entities.datetime_iso);
    if (!parsedStart) {
      missing.push("datetime_iso");
      if (diagnostics.datetime_provided) {
        diagnostics.datetime_invalid = true;
      }
    } else {
      const duration = service?.durationMin ?? 30;
      // If time is midnight (00:00), patient only provided a date (e.g. "amanhã")
      // Ask for the preferred time instead of assuming earliest slot
      const isDateOnly = this.isDateOnly(parsedStart);
      if (isDateOnly) {
        missing.push("datetime_iso");
        diagnostics.datetime_provided = true;
        diagnostics.date_only_provided = true;
      } else {
        const parsedEnd = new Date(parsedStart.getTime() + duration * 60_000);
        if (!this.policies.isWithinWorkingHours(parsedStart, parsedEnd)) {
          missing.push("datetime_iso");
          diagnostics.datetime_outside_working_hours = true;
        } else {
          startsAt = parsedStart;
          endsAt = parsedEnd;
        }
      }
    }

    // Preserve the raw date when date-only was given (for availability lookup)
    const targetDate = diagnostics.date_only_provided ? parsedStart : null;

    return {
      missing: uniqueStrings(missing),
      normalized: {
        full_name: fullName,
        service,
        professional,
        starts_at: startsAt,
        ends_at: endsAt,
        target_date: targetDate,
      },
      diagnostics,
    };
  }

  /** Check if the parsed date has no meaningful time (midnight = date-only input) */
  private isDateOnly(date: Date): boolean {
    const offsetMinutes = this.policies.timezoneOffsetMinutes;
    const localMs = date.getTime() + offsetMinutes * 60_000;
    const localDate = new Date(localMs);
    return localDate.getUTCHours() === 0 && localDate.getUTCMinutes() === 0;
  }

  /** Snap a date-only datetime to the start of working hours on that day */
  private snapToWorkingHourStart(date: Date): Date {
    const offsetMinutes = this.policies.timezoneOffsetMinutes;
    // Get local midnight
    const localMs = date.getTime() + offsetMinutes * 60_000;
    const localDate = new Date(localMs);
    // Set to working hour start in local time, convert back to UTC
    localDate.setUTCHours(this.policies.workingHourStart, 0, 0, 0);
    return new Date(localDate.getTime() - offsetMinutes * 60_000);
  }
}
