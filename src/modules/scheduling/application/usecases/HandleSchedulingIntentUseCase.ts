import type { LlmInterpretation } from "@/modules/ai/application/dto/LlmInterpretation";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import { ConfirmAppointmentUseCase } from "@/modules/scheduling/application/usecases/ConfirmAppointmentUseCase";
import { CreateHoldUseCase } from "@/modules/scheduling/application/usecases/CreateHoldUseCase";
import { ProposeSlotsUseCase } from "@/modules/scheduling/application/usecases/ProposeSlotsUseCase";
import { StartSchedulingUseCase } from "@/modules/scheduling/application/usecases/StartSchedulingUseCase";
import { LookupAvailabilityUseCase } from "@/modules/scheduling/application/usecases/LookupAvailabilityUseCase";
import type { ProfessionalAvailability } from "@/modules/scheduling/application/usecases/LookupAvailabilityUseCase";
import type { SchedulingPolicies } from "@/modules/scheduling/domain/SchedulingPolicies";
import { toIsoWithTimezone } from "@/shared/time";

function pickRandom(options: readonly string[]): string {
  return options[Math.floor(Math.random() * options.length)];
}

const AVAILABILITY_CLOSINGS = [
  "Algum desses horários funciona pra você?",
  "Qual fica melhor pra você?",
  "Alguma dessas opções te atende?",
  "Quer que eu reserve algum desses?",
  "Tem algum que te interessa?",
  "Qual você prefere?",
  "Te atende algum desses?",
] as const;

const NO_AVAILABILITY_CLOSINGS = [
  "Quer que eu procure em outro dia?",
  "Posso buscar em outra data, se preferir.",
  "Quer tentar outro dia?",
] as const;

export type HandleSchedulingInput = {
  clinic_id: string;
  patient_id: string;
  conversation_id: string;
  patient_known_name: string | null;
  interpretation: LlmInterpretation;
  now: Date;
};

export type HandleSchedulingResult = {
  reply_text: string;
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
      // ── NEW: Consolidated availability lookup ──
      // When service is known, skip asking for professional/datetime individually.
      // Instead, look up real availability and present it.
      if (start.normalized.service) {
        const availabilityResult = await this.tryConsolidatedAvailability(
          input,
          start.normalized.service,
          start.normalized.target_date,
        );
        if (availabilityResult) {
          return {
            ...availabilityResult,
            patient_name_captured: start.normalized.full_name ?? undefined,
          };
        }
      }

      // Fallback: ask for remaining missing fields
      const ask = this.buildMissingQuestion({
        missing: start.missing,
        isUrgent,
        serviceName: start.normalized.service?.name ?? null,
        professionalName: start.normalized.professional?.name ?? null,
        diagnostics: start.diagnostics,
      });
      return {
        reply_text: ask,
        conversation_state: "AUTO",
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
        reply_text: "Puxa, não encontrei horários disponíveis nesse período. Quer que eu procure em outro dia?",
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
        reply_text: "Esse horário acabou de ser ocupado. Posso buscar outro?",
        conversation_state: "AUTO",
        patient_name_captured: fullName,
      };
    }

    return {
      reply_text:
        `Reservei o horário de ${this.formatTimeOnly(selected.startsAt)} pra ${service.name}. ` +
        `Pra confirmar, é só responder CONFIRMO. A reserva vale por 10 minutos.`,
      conversation_state: "WAITING",
      patient_name_captured: fullName,
    };
  }

  /**
   * Consolidated availability lookup.
   *
   * Triggered when the service is known but professional/datetime are not yet selected.
   * Queries real availability and presents a combined view.
   *
   * Returns null if the service is known but the system should still ask individual
   * questions (e.g., when only a diagnostic error needs clarification).
   */
  private async tryConsolidatedAvailability(
    input: HandleSchedulingInput,
    service: { id: string; name: string; durationMin: number },
    targetDate: Date | null,
  ): Promise<Pick<HandleSchedulingResult, "reply_text" | "conversation_state"> | null> {
    const result = await this.lookupAvailability.execute({
      clinicId: input.clinic_id,
      serviceId: service.id,
      serviceDurationMin: service.durationMin,
      targetDate,
      now: input.now,
      maxSlotsPerProfessional: 3,
    });

    if (result.availability.length === 0) {
      if (targetDate) {
        return {
          reply_text:
            `Puxa, não encontrei horários disponíveis pra ${service.name} nesse dia. ` +
            pickRandom(NO_AVAILABILITY_CLOSINGS),
          conversation_state: "AUTO",
        };
      }
      return {
        reply_text:
          `No momento não encontrei horários disponíveis pra ${service.name} nos próximos dias. ` +
          `Quer que eu te avise quando abrir uma vaga?`,
        conversation_state: "AUTO",
      };
    }

    const text = this.formatAvailabilityResponse(service.name, result.availability, targetDate);
    return {
      reply_text: text,
      conversation_state: "AUTO",
    };
  }

  /**
   * Format availability as time-only slots (professional names hidden).
   *
   * The system merges slots from all professionals into a flat time list.
   * Professional names are NOT shown during initial suggestion — they are
   * revealed only at appointment confirmation.
   */
  private formatAvailabilityResponse(
    serviceName: string,
    availability: ProfessionalAvailability[],
    targetDate: Date | null,
  ): string {
    // Merge all slots from all professionals into a flat list with internal tracking
    type FlatSlot = { startsAt: Date; endsAt: Date; professionalId: string; professionalName: string };
    const allSlots: FlatSlot[] = [];

    for (const prof of availability) {
      for (const slot of prof.slots) {
        allSlots.push({
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          professionalId: prof.professionalId,
          professionalName: prof.professionalName,
        });
      }
    }

    // Sort by time
    allSlots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    // Deduplicate by time (if two professionals have the same slot, show it once)
    const seen = new Set<number>();
    const uniqueSlots = allSlots.filter((s) => {
      const key = s.startsAt.getTime();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Limit to a reasonable number of options
    const displaySlots = uniqueSlots.slice(0, 5);

    // Format as time-only (no professional names)
    if (targetDate) {
      // All slots are on the same day — show times only
      const dateLabel = this.formatDateLabel(targetDate);
      const times = displaySlots.map((s) => this.formatTimeOnly(s.startsAt)).join(", ");
      return `Pra ${serviceName} ${dateLabel}, tenho horário às ${times}. ${pickRandom(AVAILABILITY_CLOSINGS)}`;
    }

    // Forward search — slots may be on different days
    const timeDescriptions = displaySlots.map((s) =>
      `${this.formatDateLabel(s.startsAt)} às ${this.formatTimeOnly(s.startsAt)}`,
    );

    if (timeDescriptions.length === 1) {
      return `O horário mais próximo pra ${serviceName} é ${timeDescriptions[0]}. ${pickRandom(AVAILABILITY_CLOSINGS)}`;
    }

    return `Pra ${serviceName}, encontrei esses horários: ${timeDescriptions.join(", ")}. ${pickRandom(AVAILABILITY_CLOSINGS)}`;
  }

  private formatTimeOnly(date: Date): string {
    // Convert to São Paulo local time
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

    if (targetDay === todayDay + 1 && targetMonth === todayMonth) {
      return "amanhã";
    }

    const weekdays = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
    const day = String(targetDay).padStart(2, "0");
    const month = String(targetMonth + 1).padStart(2, "0");
    return `${weekdays[local.getUTCDay()]} (${day}/${month})`;
  }

  private buildMissingQuestion(input: {
    missing: string[];
    isUrgent: boolean;
    serviceName: string | null;
    professionalName: string | null;
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
  }): string {
    if (input.diagnostics.professional_cannot_execute_service || input.diagnostics.professional_invalid) {
      // Professional issues are handled internally — don't expose to patient.
      // Fall through to availability lookup which will auto-resolve.
    }

    if (input.diagnostics.service_invalid) {
      return "Não reconheci esse procedimento. Qual você gostaria de agendar?";
    }

    const { missing, isUrgent } = input;

    if (missing.includes("service_code")) {
      return isUrgent
        ? "Entendi que pode ser urgente. Vou priorizar uma avaliação pra você."
        : "Qual procedimento você gostaria de agendar?";
    }

    if (missing.includes("datetime_iso")) {
      if (input.diagnostics.datetime_outside_working_hours) {
        return `Esse horário está fora do nosso expediente (${this.workingHoursText()}). Qual outro horário funciona pra você?`;
      }
      if (input.diagnostics.datetime_invalid && input.diagnostics.datetime_provided) {
        return "Não consegui entender a data/hora. Pode informar de novo?";
      }
      return isUrgent
        ? "Qual o primeiro horário que funciona pra você hoje?"
        : `Qual data e horário funcionam pra você? Nosso expediente é das ${this.workingHoursText()}.`;
    }

    if (missing.includes("full_name")) {
      return isUrgent
        ? "Pra agilizar, pode me dizer seu nome completo?"
        : "Pra eu dar andamento, pode me informar seu nome completo?";
    }

    if (missing.includes("care_type")) {
      return "Vai ser particular ou por convênio?";
    }

    return "Pode me passar mais detalhes pra continuar?";
  }

  private async handleHoldConfirmation(input: HandleSchedulingInput): Promise<HandleSchedulingResult> {
    const fullName = input.interpretation.entities.full_name?.trim() || input.patient_known_name || null;
    if (!fullName) {
      return {
        reply_text: "Pra finalizar, pode me dizer seu nome completo?",
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
          reply_text: "A reserva expirou. Quer que eu busque novos horários?",
          conversation_state: "AUTO",
          patient_name_captured: fullName,
        };
      }
      if (confirmed.error === "UNAVAILABLE") {
        return {
          reply_text: "Esse horário foi ocupado. Vou procurar outras opções pra você.",
          conversation_state: "AUTO",
          patient_name_captured: fullName,
        };
      }
      return {
        reply_text: "Não consegui finalizar agora. Vamos tentar de novo?",
        conversation_state: "AUTO",
        patient_name_captured: fullName,
      };
    }

    return {
      reply_text: `Perfeito, tá confirmado! Seu atendimento ficou pra ${confirmed.value.starts_at.toLocaleString("pt-BR")} com ${confirmed.value.professional_name}. Te esperamos! 😊`,
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
