"use client";
import { Tag } from "antd";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  // Appointment statuses
  PENDING: { color: "blue", label: "Pendente" },
  CONFIRMED: { color: "green", label: "Confirmado" },
  RESCHEDULED: { color: "geekblue", label: "Reagendado" },
  CANCELLED: { color: "red", label: "Cancelado" },
  NO_SHOW: { color: "orange", label: "No Show" },
  IN_PROGRESS: { color: "cyan", label: "Em Atendimento" },
  COMPLETED: { color: "success", label: "Concluído" },
  // Conversation states
  AUTO: { color: "processing", label: "Auto" },
  WAITING: { color: "warning", label: "Aguardando" },
  HUMAN: { color: "purple", label: "Humano" },
  FINALIZADA: { color: "default", label: "Finalizada" },
  // Patient lifecycle
  LEAD_NEW: { color: "blue", label: "Novo Lead" },
  LEAD_QUALIFIED: { color: "cyan", label: "Qualificado" },
  LEAD_INACTIVE: { color: "default", label: "Lead Inativo" },
  ACTIVE: { color: "green", label: "Ativo" },
  INACTIVE: { color: "default", label: "Inativo" },
  // Outbox (PENDING already defined above for appointments)
  PROCESSING: { color: "warning", label: "Processando" },
  DONE: { color: "success", label: "Concluído" },
  FAILED: { color: "error", label: "Falhou" },
  // Hold
  HELD: { color: "warning", label: "Reservado" },
  EXPIRED: { color: "default", label: "Expirado" },
  RELEASED: { color: "default", label: "Liberado" },
  CONVERTED: { color: "success", label: "Convertido" },
};

type StatusTagProps = {
  status: string;
};

export function StatusTag({ status }: StatusTagProps) {
  const config = STATUS_CONFIG[status];
  if (!config) {
    return <Tag>{status}</Tag>;
  }
  return <Tag color={config.color}>{config.label}</Tag>;
}
