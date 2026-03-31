import { z } from "zod";
import type { AgentToolCall, AgentToolResult } from "@/modules/ai/domain/AgentTool";
import type {
  CancellationHandlerPort,
  CatalogSnapshotPort,
  ConfirmPresenceHandlerPort,
  RescheduleHandlerPort,
} from "@/modules/conversations/application/ports/IntentHandlerPorts";
import type { KnowledgeRetrievalPort } from "@/modules/knowledge/application/ports/KnowledgeRetrievalPort";
import type { ClinicSettingsPort } from "@/modules/clinic/application/ports/ClinicSettingsPort";
import type { LookupAvailabilityUseCase } from "@/modules/scheduling/application/usecases/LookupAvailabilityUseCase";
import type { CreateHoldUseCase } from "@/modules/scheduling/application/usecases/CreateHoldUseCase";
import type { ConfirmAppointmentUseCase } from "@/modules/scheduling/application/usecases/ConfirmAppointmentUseCase";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import { formatDateTimePtBr } from "@/shared/time";

export type ToolExecutorDeps = {
  clinicId: string;
  patientId: string;
  conversationId: string;
  allPatientIds: string[];
  catalogSnapshot: CatalogSnapshotPort;
  catalogRepository: CatalogRepositoryPort;
  knowledgeRetrieval: KnowledgeRetrievalPort | null;
  clinicSettings: ClinicSettingsPort | null;
  lookupAvailability: LookupAvailabilityUseCase;
  createHold: CreateHoldUseCase;
  confirmAppointment: ConfirmAppointmentUseCase;
  cancelAppointment: CancellationHandlerPort;
  confirmPresence: ConfirmPresenceHandlerPort;
  rescheduleAppointment: RescheduleHandlerPort | null;
};

/**
 * Executes agent tool calls by dispatching to existing use cases.
 *
 * Each tool handler:
 * 1. Validates arguments with Zod
 * 2. Calls the existing use case
 * 3. Returns a JSON-stringified result
 *
 * On validation error, returns a structured error message the LLM can learn from.
 */
export class ToolExecutor {
  constructor(private readonly deps: ToolExecutorDeps) {}

  async execute(call: AgentToolCall): Promise<AgentToolResult> {
    try {
      const args = JSON.parse(call.function.arguments);
      const result = await this.dispatch(call.function.name, args);
      return { tool_call_id: call.id, content: JSON.stringify(result) };
    } catch (error) {
      const message = error instanceof z.ZodError
        ? `Argumentos inválidos: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
        : error instanceof Error ? error.message : "Erro desconhecido";
      return { tool_call_id: call.id, content: JSON.stringify({ error: message }) };
    }
  }

  private async dispatch(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (name) {
      case "list_services": return this.listServices();
      case "get_service_info": return this.getServiceInfo(args);
      case "check_availability": return this.checkAvailability(args);
      case "reserve_slot": return this.reserveSlot(args);
      case "confirm_appointment": return this.confirmAppointment(args);
      case "cancel_appointment": return this.cancelAppointment(args);
      case "confirm_presence": return this.confirmPresence(args);
      case "reschedule_appointment": return this.rescheduleAppointment(args);
      case "lookup_knowledge": return this.lookupKnowledge(args);
      case "get_clinic_hours": return this.getClinicHours();
      case "escalate_to_human": return this.escalateToHuman(args);
      default: return { error: `Ferramenta desconhecida: ${name}` };
    }
  }

  private async listServices(): Promise<Record<string, unknown>> {
    const snapshot = await this.deps.catalogSnapshot.execute(this.deps.clinicId);
    return { services: snapshot.services, professionals: snapshot.professionals };
  }

  private async getServiceInfo(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { service_code, query } = z.object({
      service_code: z.string(),
      query: z.string().optional(),
    }).parse(args);

    const snapshot = await this.deps.catalogSnapshot.execute(this.deps.clinicId);
    const service = snapshot.services.find((s) => s.service_code === service_code);
    if (!service) return { error: `Serviço não encontrado: ${service_code}` };

    const result: Record<string, unknown> = {
      name: service.name,
      duration_min: service.duration_min,
      service_code: service.service_code,
    };

    if (this.deps.knowledgeRetrieval) {
      const docs = await this.deps.knowledgeRetrieval.findRelevant({
        clinicId: this.deps.clinicId,
        category: service_code,
        searchText: query ?? service.name,
        limit: 3,
      });
      if (docs.length > 0) {
        result.knowledge = docs.map((d) => ({ title: d.title, content: d.content }));
      }
    }

    return result;
  }

  private async checkAvailability(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { service_id, service_duration_min, target_date, professional_name } = z.object({
      service_id: z.string(),
      service_duration_min: z.number(),
      target_date: z.string().optional(),
      professional_name: z.string().optional(),
    }).parse(args);

    const result = await this.deps.lookupAvailability.execute({
      clinicId: this.deps.clinicId,
      serviceId: service_id,
      serviceDurationMin: service_duration_min,
      targetDate: target_date ? new Date(target_date) : null,
      now: new Date(),
      maxSlotsPerProfessional: 3,
    });

    let availability = result.availability;
    if (professional_name) {
      const needle = professional_name.toLowerCase();
      availability = availability.filter((prof) =>
        prof.professionalName.toLowerCase().includes(needle),
      );
    }

    if (availability.length === 0) {
      return { available: false, message: "Nenhum horário disponível nesse período." };
    }

    return {
      available: true,
      slots: availability.flatMap((prof) =>
        prof.slots.map((slot) => ({
          professional_id: prof.professionalId,
          professional_name: prof.professionalName,
          starts_at: slot.startsAt.toISOString(),
          ends_at: slot.endsAt.toISOString(),
          display: `${prof.professionalName} — ${formatDateTimePtBr(slot.startsAt)}`,
        })),
      ),
    };
  }

  private async reserveSlot(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { professional_id, service_id, starts_at, ends_at } = z.object({
      professional_id: z.string(),
      service_id: z.string(),
      starts_at: z.string(),
      ends_at: z.string(),
    }).parse(args);

    const result = await this.deps.createHold.execute({
      clinic_id: this.deps.clinicId,
      conversation_id: this.deps.conversationId,
      patient_id: this.deps.patientId,
      professional_id,
      service_id,
      starts_at: new Date(starts_at),
      ends_at: new Date(ends_at),
      now: new Date(),
    });

    if (!result.ok) {
      return { reserved: false, error: result.error === "UNAVAILABLE" ? "Horário indisponível." : "Horário fora do expediente." };
    }

    return { reserved: true, hold_id: result.value.hold_id, expires_at: result.value.expires_at.toISOString() };
  }

  private async confirmAppointment(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { patient_name } = z.object({
      patient_name: z.string().min(1),
    }).parse(args);

    const result = await this.deps.confirmAppointment.execute({
      clinic_id: this.deps.clinicId,
      conversation_id: this.deps.conversationId,
      patient_id: this.deps.patientId,
      patient_name,
      now: new Date(),
    });

    if (!result.ok) {
      const errorMap: Record<string, string> = {
        NO_ACTIVE_HOLD: "Não há reserva ativa. Use reserve_slot primeiro.",
        HOLD_EXPIRED: "A reserva expirou.",
        UNAVAILABLE: "O horário foi ocupado.",
        CATALOG_NOT_FOUND: "Erro interno ao buscar dados do catálogo.",
      };
      return { confirmed: false, error: errorMap[result.error] ?? result.error };
    }

    return {
      confirmed: true,
      appointment: {
        id: result.value.appointment_id,
        status: result.value.status,
        starts_at: result.value.starts_at.toISOString(),
        ends_at: result.value.ends_at.toISOString(),
        professional_name: result.value.professional_name,
        service_code: result.value.service_code,
        display: `${formatDateTimePtBr(result.value.starts_at)} com ${result.value.professional_name}`,
      },
    };
  }

  private async cancelAppointment(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { requested_datetime_iso, reason } = z.object({
      requested_datetime_iso: z.string().optional(),
      reason: z.string().optional(),
    }).parse(args);

    const result = await this.deps.cancelAppointment.execute({
      patient_id: this.deps.patientId,
      all_patient_ids: this.deps.allPatientIds,
      requested_datetime_iso: requested_datetime_iso ?? null,
      reason: reason ?? null,
      now: new Date(),
    });

    if (result.kind === "NO_APPOINTMENTS") return { cancelled: false, reason: "Paciente não tem agendamentos ativos." };
    if (result.kind === "NEEDS_CLARIFICATION") {
      return {
        cancelled: false,
        needs_clarification: true,
        options: result.options.map((o, i) => ({
          index: i + 1,
          display: `${formatDateTimePtBr(new Date(o.starts_at_iso))} - ${o.service_code} com ${o.professional_name}`,
          starts_at_iso: o.starts_at_iso,
        })),
      };
    }

    return {
      cancelled: true,
      appointment: {
        id: result.appointment.id,
        service_code: result.appointment.service_code,
        display: `${formatDateTimePtBr(new Date(result.appointment.starts_at_iso))} (${result.appointment.service_code})`,
      },
    };
  }

  private async confirmPresence(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { requested_datetime_iso } = z.object({
      requested_datetime_iso: z.string().optional(),
    }).parse(args);

    const result = await this.deps.confirmPresence.execute({
      patient_id: this.deps.patientId,
      all_patient_ids: this.deps.allPatientIds,
      requested_datetime_iso: requested_datetime_iso ?? null,
      now: new Date(),
    });

    if (result.kind === "NO_APPOINTMENTS") return { confirmed: false, reason: "Não há agendamento para confirmar presença." };
    if (result.kind === "NEEDS_CLARIFICATION") {
      return {
        confirmed: false,
        needs_clarification: true,
        options: result.options.map((o, i) => ({
          index: i + 1,
          display: `${formatDateTimePtBr(new Date(o.starts_at_iso))} - ${o.service_code} com ${o.professional_name}`,
          starts_at_iso: o.starts_at_iso,
        })),
      };
    }

    return {
      confirmed: true,
      appointment: {
        id: result.appointment.id,
        display: `${formatDateTimePtBr(new Date(result.appointment.starts_at_iso))}`,
      },
    };
  }

  private async rescheduleAppointment(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.deps.rescheduleAppointment) {
      return { error: "Reagendamento não está disponível." };
    }

    const { requested_datetime_iso, new_datetime_iso } = z.object({
      requested_datetime_iso: z.string().optional(),
      new_datetime_iso: z.string().optional(),
    }).parse(args);

    const result = await this.deps.rescheduleAppointment.execute({
      patient_id: this.deps.patientId,
      all_patient_ids: this.deps.allPatientIds,
      clinic_id: this.deps.clinicId,
      requested_datetime_iso: requested_datetime_iso ?? null,
      new_datetime_iso: new_datetime_iso ?? null,
      now: new Date(),
    });

    switch (result.kind) {
      case "NO_APPOINTMENTS":
        return { rescheduled: false, reason: "Não há agendamentos futuros." };
      case "NEEDS_CLARIFICATION":
        return {
          rescheduled: false,
          needs_clarification: true,
          options: result.options.map((o, i) => ({
            index: i + 1,
            display: `${o.service_code} com ${o.professional_name} — ${formatDateTimePtBr(new Date(o.starts_at_iso))}`,
            starts_at_iso: o.starts_at_iso,
          })),
        };
      case "NEEDS_NEW_DATETIME":
        return {
          rescheduled: false,
          needs_new_datetime: true,
          current: `${result.current_appointment.service_code} com ${result.current_appointment.professional_name}`,
        };
      case "SLOT_UNAVAILABLE":
        return {
          rescheduled: false,
          slot_unavailable: true,
          available_times: result.available_times ?? [],
        };
      case "RESCHEDULED":
        return {
          rescheduled: true,
          new_appointment: {
            id: result.new_appointment.id,
            display: `${formatDateTimePtBr(new Date(result.new_appointment.starts_at_iso))} com ${result.new_appointment.professional_name}`,
          },
        };
    }
  }

  private async lookupKnowledge(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.deps.knowledgeRetrieval) return { documents: [] };

    const { query, category } = z.object({
      query: z.string(),
      category: z.string().optional(),
    }).parse(args);

    const docs = await this.deps.knowledgeRetrieval.findRelevant({
      clinicId: this.deps.clinicId,
      searchText: query,
      category,
      limit: 5,
    });

    return { documents: docs.map((d) => ({ title: d.title, content: d.content })) };
  }

  private async getClinicHours(): Promise<Record<string, unknown>> {
    const settings = await this.deps.clinicSettings?.findByClinicId(this.deps.clinicId);
    if (!settings) {
      return { hours: "segunda a sexta, das 08:00 às 19:00", timezone: "America/Sao_Paulo" };
    }
    return {
      hours: `${settings.workingDaysText}, das ${settings.workingHoursText}`,
      timezone: settings.timezone,
    };
  }

  private async escalateToHuman(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { reason } = z.object({ reason: z.string().optional() }).parse(args);
    return { escalated: true, reason: reason ?? "Paciente solicitou atendente humano." };
  }
}
