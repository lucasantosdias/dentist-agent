"use client";
import { Tag } from "antd";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  // Appointment statuses
  AGENDADA: { color: "blue", label: "Agendada" },
  CONFIRMADA: { color: "green", label: "Confirmada" },
  CANCELADA: { color: "red", label: "Cancelada" },
  NO_SHOW: { color: "orange", label: "No Show" },
  COMPARECEU: { color: "cyan", label: "Compareceu" },
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
  // Outbox
  PENDING: { color: "processing", label: "Pendente" },
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
