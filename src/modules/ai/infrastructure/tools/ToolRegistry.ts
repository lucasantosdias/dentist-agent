import type { AgentToolDefinition } from "@/modules/ai/domain/AgentTool";

/**
 * Registry of all tools available to the agent.
 *
 * Each tool is defined using JSON Schema, compatible with both
 * Ollama and OpenAI tool-calling APIs.
 */

export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_services",
      description: "Lista os procedimentos/serviços disponíveis na clínica. Use quando o paciente perguntar quais procedimentos estão disponíveis.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_service_info",
      description: "Busca informações detalhadas sobre um procedimento específico (descrição, duração, preparo, etc). Use quando o paciente perguntar sobre como funciona um procedimento.",
      parameters: {
        type: "object",
        properties: {
          service_code: { type: "string", description: "Código do serviço (ex: LIMPEZA, CLAREAMENTO, CANAL)" },
          query: { type: "string", description: "Pergunta do paciente sobre o serviço" },
        },
        required: ["service_code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Consulta horários disponíveis para um procedimento. Retorna lista de horários por profissional. Use DEPOIS de saber qual procedimento o paciente quer.",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string", description: "ID do serviço" },
          service_duration_min: { type: "number", description: "Duração do serviço em minutos" },
          target_date: { type: "string", description: "Data-alvo ISO 8601 (opcional — se omitido, busca o próximo dia disponível)" },
          professional_name: { type: "string", description: "Nome do profissional (opcional — filtra resultados para este profissional)" },
        },
        required: ["service_id", "service_duration_min"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reserve_slot",
      description: "Reserva temporariamente um horário para o paciente. A reserva expira em alguns minutos. O paciente DEVE confirmar com 'CONFIRMO' antes de chamar confirm_appointment. IMPORTANTE: Copie professional_id, service_id, starts_at e ends_at EXATAMENTE do resultado de check_availability — NÃO invente IDs.",
      parameters: {
        type: "object",
        properties: {
          professional_id: { type: "string", description: "UUID do profissional (copiar de check_availability)" },
          service_id: { type: "string", description: "UUID do serviço (copiar de check_availability)" },
          starts_at: { type: "string", description: "Início do horário ISO 8601" },
          ends_at: { type: "string", description: "Fim do horário ISO 8601" },
        },
        required: ["professional_id", "service_id", "starts_at", "ends_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_appointment",
      description: "Confirma o agendamento a partir de uma reserva existente. SOMENTE use quando o paciente disser 'CONFIRMO', 'sim', 'pode ser' ou equivalente. Requer nome completo do paciente.",
      parameters: {
        type: "object",
        properties: {
          patient_name: { type: "string", description: "Nome completo do paciente" },
        },
        required: ["patient_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancela um agendamento do paciente. Se houver múltiplos agendamentos, retorna opções para o paciente escolher.",
      parameters: {
        type: "object",
        properties: {
          requested_datetime_iso: { type: "string", description: "Data/hora do agendamento a cancelar (opcional)" },
          reason: { type: "string", description: "Motivo do cancelamento" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_presence",
      description: "Confirma a presença/check-in do paciente em um agendamento existente.",
      parameters: {
        type: "object",
        properties: {
          requested_datetime_iso: { type: "string", description: "Data/hora do agendamento (opcional)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Reagenda um agendamento existente para um novo horário. Se houver múltiplos agendamentos, retorna opções.",
      parameters: {
        type: "object",
        properties: {
          requested_datetime_iso: { type: "string", description: "Data/hora do agendamento atual (opcional)" },
          new_datetime_iso: { type: "string", description: "Nova data/hora desejada" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_knowledge",
      description: "Busca informações da clínica (FAQ, políticas, convênios, localização, etc). Use para responder perguntas sobre a clínica.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto da busca" },
          category: { type: "string", description: "Categoria (opcional): CLINIC_INFO, INSURANCE, FAQ, LOCATION" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_clinic_hours",
      description: "Retorna o horário de funcionamento da clínica.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_to_human",
      description: "Transfere o paciente para um atendente humano. Use SOMENTE quando o paciente pedir explicitamente ou após falhas repetidas.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Motivo da transferência" },
        },
        required: [],
      },
    },
  },
];
