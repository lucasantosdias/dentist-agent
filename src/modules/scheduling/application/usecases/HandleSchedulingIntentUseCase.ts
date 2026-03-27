import type { LlmInterpretation } from "@/modules/ai/application/dto/LlmInterpretation";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import { ConfirmAppointmentUseCase } from "@/modules/scheduling/application/usecases/ConfirmAppointmentUseCase";
import { CreateHoldUseCase } from "@/modules/scheduling/application/usecases/CreateHoldUseCase";
import { ProposeSlotsUseCase } from "@/modules/scheduling/application/usecases/ProposeSlotsUseCase";
import { StartSchedulingUseCase } from "@/modules/scheduling/application/usecases/StartSchedulingUseCase";
import { LookupAvailabilityUseCase } from "@/modules/scheduling/application/usecases/LookupAvailabilityUseCase";
import type { ProfessionalAvailability } from "@/modules/scheduling/application/usecases/LookupAvailabilityUseCase";
import type { SchedulingPolicies } from "@/modules/scheduling/domain/SchedulingPolicies";
import { formatDateTimePtBr } from "@/shared/time";

export type HandleSchedulingInput = {
  clinic_id: string;
  patient_id: string;
  conversation_id: string;
  patient_known_name: string | null;
  interpretation: LlmInterpretation;
  now: Date;
};

export type HandleSchedulingResult = {
  goal: string;
  facts: string[];
  constraints: string[];
  missing_fields: string[];
  conversation_state: "AUTO" | "WAITING";
  appointment?: {
    id: string;
    status: string;
    starts_at: string;
    ends_at: string;
    professional_name: string;
    service_code: string;
  };
  patient_name_captured?: string;
};

export class HandleSchedulingIntentUseCase {
  private readonly lookupAvailability: LookupAvailabilityUseCase;

  constructor(
    private readonly catalogRepository: CatalogRepositoryPort,
    private readonly startSchedulingUseCase: StartSchedulingUseCase,
    private readonly proposeSlotsUseCase: ProposeSlotsUseCase,
    private readonly createHoldUseCase: CreateHoldUseCase,
    private readonly confirmAppointmentUseCase: ConfirmAppointmentUseCase,
    private readonly schedulingPolicies: SchedulingPolicies,
  ) {
    this.lookupAvailability = new LookupAvailabilityUseCase(
      catalogRepository,
      proposeSlotsUseCase,
      schedulingPolicies,
    );
  }

  async execute(input: HandleSchedulingInput): Promise<HandleSchedulingResult> {
    // Handle hold confirmation
    if (
      input.interpretation.stage === "USER_CONFIRMED_DETAILS" &&
      input.interpretation.user_accepts_slot === true
    ) {
      return this.handleHoldConfirmation(input);
    }

    const isUrgent = input.interpretation.entities.urgency_level === "ALTA";

    const start = await this.startSchedulingUseCase.execute({
      clinic_id: input.clinic_id,
      patient_known_name: input.patient_known_name,
      entities: input.interpretation.entities,
      llm_missing: input.interpretation.missing,
    });

    if (start.missing.length > 0) {
      const missingWithoutProfessional = start.missing.filter((f) => f !== "professional_name");
      const onlyMissingProfessional = missingWithoutProfessional.length === 0
        && start.missing.includes("professional_name");

      if (onlyMissingProfessional && start.normalized.service && start.normalized.starts_at) {
        return this.autoAssignAndHold(input, start);
      }

      // Consolidated availability lookup when service is known but datetime is not
      if (start.normalized.service && !start.normalized.starts_at) {
        const availabilityResult = await this.tryConsolidatedAvailability(
          input,
          start.normalized.service,
          start.normalized.target_date,
          start.normalized.professional?.id ?? null,
        );
        if (availabilityResult) {
          return {
            ...availabilityResult,
            patient_name_captured: start.normalized.full_name ?? undefined,
          };
        }
      }

      // Ask for remaining missing fields
      const result = this.buildMissingFieldResult({
        missing: start.missing,
        isUrgent,
        serviceName: start.normalized.service?.name ?? null,
        diagnostics: start.diagnostics,
      });
      return {
        ...result,
        patient_name_captured: start.normalized.full_name ?? undefined,
      };
    }

    // All data collected — propose specific slot and create hold
    const fullName = start.normalized.full_name!;
    const service = start.normalized.service!;
    const professional = start.normalized.professional!;

    const slots = await this.proposeSlotsUseCase.execute({
      professionalId: professional.id,
      serviceDurationMin: service.durationMin,
      requestedStartsAt: start.normalized.starts_at,
      now: input.now,
      limit: 3,
    });

    if (slots.length === 0) {
      return {
        goal: "no_slots_available",
        facts: ["Não foram encontrados horários disponíveis nesse período."],
        constraints: ["Não invente horários."],
        missing_fields: ["datetime_iso"],
        conversation_state: "AUTO",
        patient_name_captured: fullName,
      };
    }

    const selected = slots[0];
    const hold = await this.createHoldUseCase.execute({
      clinic_id: input.clinic_id,
      conversation_id: input.conversation_id,
      patient_id: input.patient_id,
      professional_id: professional.id,
      service_id: service.id,
      starts_at: selected.startsAt,
      ends_at: selected.endsAt,
      now: input.now,
    });

    if (!hold.ok) {
      return {
        goal: "slot_taken",
        facts: ["O horário solicitado acabou de ser ocupado."],
        constraints: [],
        missing_fields: ["datetime_iso"],
        conversation_state: "AUTO",
        patient_name_captured: fullName,
      };
    }

    const ttl = this.schedulingPolicies.holdTtlMinutes;
    return {
      goal: "hold_created_awaiting_confirmation",
      facts: [
        `Horário reservado: ${this.formatTimeOnly(selected.startsAt)} para ${service.name}.`,
        `O paciente deve responder CONFIRMO para finalizar. A reserva vale por ${ttl} minutos.`,
      ],
      constraints: [
        "NÃO confirme o agendamento — apenas informe a reserva e peça confirmação.",
        "Mencione que o paciente deve responder CONFIRMO.",
      ],
      missing_fields: [],
      conversation_state: "WAITING",
      patient_name_captured: fullName,
    };
  }

  private async tryConsolidatedAvailability(
    input: HandleSchedulingInput,
    service: { id: string; name: string; durationMin: number },
    targetDate: Date | null,
    professionalId: string | null,
  ): Promise<Pick<HandleSchedulingResult, "goal" | "facts" | "constraints" | "missing_fields" | "conversation_state"> | null> {
    const result = await this.lookupAvailability.execute({
      clinicId: input.clinic_id,
      serviceId: service.id,
      serviceDurationMin: service.durationMin,
      targetDate,
      now: input.now,
      maxSlotsPerProfessional: 3,
      ...(professionalId ? { professionalId } : {}),
    });

    if (result.availability.length === 0) {
      if (targetDate) {
        return {
          goal: "no_slots_on_date",
          facts: [`Não há horários disponíveis para ${service.name} nessa data.`],
          constraints: ["Não invente horários."],
          missing_fields: ["datetime_iso"],
          conversation_state: "AUTO",
        };
      }
      return {
        goal: "no_slots_upcoming",
        facts: [`Não há horários disponíveis para ${service.name} nos próximos dias.`],
        constraints: ["Não invente horários."],
        missing_fields: [],
        conversation_state: "AUTO",
      };
    }

    const displayDate = targetDate ?? result.searchedDate;
    const slotLines = this.formatSlotLines(result.availability, displayDate);
    const dateLabel = displayDate ? this.formatDateLabel(displayDate) : null;

    return {
      goal: "offer_available_slots",
      facts: [
        dateLabel
          ? `Horários disponíveis para ${service.name} ${dateLabel}:`
          : `Horários disponíveis para ${service.name}:`,
        ...slotLines,
      ],
      constraints: [
        "Apresente TODOS os horários listados nos fatos — NÃO diga 'aguarde' ou 'vou verificar'.",
        "Pergunte qual horário o paciente prefere.",
        "NÃO invente horários além dos listados.",
      ],
      missing_fields: ["datetime_iso"],
      conversation_state: "AUTO",
    };
  }

  private formatSlotLines(
    availability: ProfessionalAvailability[],
    targetDate: Date | null,
  ): string[] {
    type FlatSlot = { startsAt: Date; professionalName: string };
    const allSlots: FlatSlot[] = [];

    for (const prof of availability) {
      for (const slot of prof.slots) {
        allSlots.push({ startsAt: slot.startsAt, professionalName: prof.professionalName });
      }
    }

    allSlots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const displaySlots = allSlots.slice(0, 6);

    return displaySlots.map((s) => {
      const time = this.formatTimeOnly(s.startsAt);
      const day = targetDate ? this.formatDateLabel(targetDate) : this.formatDateLabel(s.startsAt);
      return `${s.professionalName} — ${day} às ${time}`;
    });
  }

  private formatTimeOnly(date: Date): string {
    const offset = this.schedulingPolicies.timezoneOffsetMinutes;
    const local = new Date(date.getTime() + offset * 60_000);
    const h = String(local.getUTCHours()).padStart(2, "0");
    const m = String(local.getUTCMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  private formatDateLabel(date: Date): string {
    const offset = this.schedulingPolicies.timezoneOffsetMinutes;
    const local = new Date(date.getTime() + offset * 60_000);
    const now = new Date();
    const todayLocal = new Date(now.getTime() + offset * 60_000);

    const targetDay = local.getUTCDate();
    const todayDay = todayLocal.getUTCDate();
    const targetMonth = local.getUTCMonth();
    const todayMonth = todayLocal.getUTCMonth();

    if (targetDay === todayDay + 1 && targetMonth === todayMonth) return "amanhã";

    const weekdays = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
    const day = String(targetDay).padStart(2, "0");
    const month = String(targetMonth + 1).padStart(2, "0");
    return `${weekdays[local.getUTCDay()]} (${day}/${month})`;
  }

  private buildMissingFieldResult(input: {
    missing: string[];
    isUrgent: boolean;
    serviceName: string | null;
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
  }): Pick<HandleSchedulingResult, "goal" | "facts" | "constraints" | "missing_fields" | "conversation_state"> {
    const facts: string[] = [];
    const constraints: string[] = [];

    if (input.diagnostics.service_invalid) {
      facts.push("O procedimento informado não foi reconhecido.");
      return {
        goal: "ask_missing_field:service_code",
        facts,
        constraints,
        missing_fields: ["service_code"],
        conversation_state: "AUTO",
      };
    }

    if (input.diagnostics.datetime_outside_working_hours) {
      facts.push(`O horário solicitado está fora do expediente (${this.workingHoursText()}).`);
      constraints.push("Mencione o horário de expediente.");
    }

    if (input.diagnostics.datetime_invalid && input.diagnostics.datetime_provided) {
      facts.push("Não foi possível interpretar a data/hora informada.");
    }

    if (input.isUrgent) {
      facts.push("O paciente indicou urgência.");
    }

    if (input.missing.includes("service_code")) {
      return {
        goal: input.isUrgent ? "urgent_ask_service" : "ask_missing_field:service_code",
        facts,
        constraints,
        missing_fields: input.missing,
        conversation_state: "AUTO",
      };
    }

    return {
      goal: `ask_missing_field:${input.missing[0]}`,
      facts: [
        ...facts,
        ...(input.missing.includes("datetime_iso")
          ? [`Expediente: ${this.workingHoursText()}.`]
          : []),
      ],
      constraints,
      missing_fields: input.missing,
      conversation_state: "AUTO",
    };
  }

  private async autoAssignAndHold(
    input: HandleSchedulingInput,
    start: { normalized: { full_name: string | null; service: { id: string; name: string; durationMin: number } | null; starts_at: Date | null; ends_at: Date | null }; missing: string[] },
  ): Promise<HandleSchedulingResult> {
    const service = start.normalized.service!;
    const startsAt = start.normalized.starts_at!;
    const endsAt = start.normalized.ends_at ?? new Date(startsAt.getTime() + service.durationMin * 60_000);

    const allProfessionals = await this.catalogRepository.listActiveProfessionalsForService(
      input.clinic_id,
      service.id,
    );

    const mentionedProfName = input.interpretation.entities.professional_name;
    const professionals = mentionedProfName
      ? [
          ...allProfessionals.filter((p) => p.name.toLowerCase().includes(mentionedProfName.toLowerCase())),
          ...allProfessionals.filter((p) => !p.name.toLowerCase().includes(mentionedProfName.toLowerCase())),
        ]
      : allProfessionals;

    for (const prof of professionals) {
      const slots = await this.proposeSlotsUseCase.execute({
        professionalId: prof.id,
        serviceDurationMin: service.durationMin,
        requestedStartsAt: startsAt,
        now: input.now,
        limit: 1,
      });

      const matchingSlot = slots.find((s) => s.startsAt.getTime() === startsAt.getTime());
      if (!matchingSlot) continue;

      const hold = await this.createHoldUseCase.execute({
        clinic_id: input.clinic_id,
        conversation_id: input.conversation_id,
        patient_id: input.patient_id,
        professional_id: prof.id,
        service_id: service.id,
        starts_at: matchingSlot.startsAt,
        ends_at: matchingSlot.endsAt,
        now: input.now,
      });

      if (hold.ok) {
        const ttl = this.schedulingPolicies.holdTtlMinutes;
        return {
          goal: "hold_created_awaiting_confirmation",
          facts: [
            `Horário reservado: ${this.formatTimeOnly(matchingSlot.startsAt)} para ${service.name}.`,
            `O paciente deve responder CONFIRMO para finalizar. A reserva vale por ${ttl} minutos.`,
          ],
          constraints: [
            "NÃO confirme o agendamento — apenas informe a reserva e peça confirmação.",
            "Mencione que o paciente deve responder CONFIRMO.",
          ],
          missing_fields: [],
          conversation_state: "WAITING",
          patient_name_captured: start.normalized.full_name ?? undefined,
        };
      }
    }

    return {
      goal: "slot_taken",
      facts: ["O horário solicitado foi ocupado."],
      constraints: [],
      missing_fields: ["datetime_iso"],
      conversation_state: "AUTO",
      patient_name_captured: start.normalized.full_name ?? undefined,
    };
  }

  private async handleHoldConfirmation(input: HandleSchedulingInput): Promise<HandleSchedulingResult> {
    const fullName = input.interpretation.entities.full_name?.trim() || input.patient_known_name || null;
    if (!fullName) {
      return {
        goal: "ask_missing_field:full_name",
        facts: ["Precisamos do nome completo para finalizar o agendamento."],
        constraints: [],
        missing_fields: ["full_name"],
        conversation_state: "AUTO",
      };
    }

    const confirmed = await this.confirmAppointmentUseCase.execute({
      clinic_id: input.clinic_id,
      conversation_id: input.conversation_id,
      patient_id: input.patient_id,
      patient_name: fullName,
      now: input.now,
    });

    if (!confirmed.ok) {
      if (confirmed.error === "NO_ACTIVE_HOLD" || confirmed.error === "HOLD_EXPIRED") {
        return {
          goal: "hold_expired",
          facts: ["A reserva de horário expirou."],
          constraints: [],
          missing_fields: ["datetime_iso"],
          conversation_state: "AUTO",
          patient_name_captured: fullName,
        };
      }
      if (confirmed.error === "UNAVAILABLE") {
        return {
          goal: "slot_taken",
          facts: ["O horário reservado foi ocupado por outro paciente."],
          constraints: [],
          missing_fields: ["datetime_iso"],
          conversation_state: "AUTO",
          patient_name_captured: fullName,
        };
      }
      return {
        goal: "confirmation_error",
        facts: ["Não foi possível finalizar o agendamento agora."],
        constraints: [],
        missing_fields: [],
        conversation_state: "AUTO",
        patient_name_captured: fullName,
      };
    }

    return {
      goal: "appointment_confirmed",
      facts: [
        `Agendamento confirmado: ${formatDateTimePtBr(confirmed.value.starts_at)} com ${confirmed.value.professional_name}.`,
      ],
      constraints: [],
      missing_fields: [],
      conversation_state: "AUTO",
      appointment: {
        id: confirmed.value.appointment_id,
        status: confirmed.value.status,
        starts_at: confirmed.value.starts_at.toISOString(),
        ends_at: confirmed.value.ends_at.toISOString(),
        professional_name: confirmed.value.professional_name,
        service_code: confirmed.value.service_code,
      },
      patient_name_captured: fullName,
    };
  }

  private workingHoursText(): string {
    return `${this.hourToLabel(this.schedulingPolicies.workingHourStart)} às ${this.hourToLabel(this.schedulingPolicies.workingHourEnd)}`;
  }

  private hourToLabel(value: number): string {
    return `${String(value).padStart(2, "0")}:00`;
  }
}
