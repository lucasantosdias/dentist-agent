"use client";

import { useState, useMemo } from "react";
import { Table, Input, Select, Flex, Button, Space, Empty, Card, Tag } from "antd";
import { ReloadOutlined, SearchOutlined, CalendarOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusTag } from "@/components/ui/StatusTag";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useApi } from "@/hooks/useApi";
import { useClinicContext } from "@/hooks/useClinicContext";
import type { ColumnsType } from "antd/es/table";

type Appointment = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  service_code: string;
  service_name: string;
  professional_name: string;
  patient_name: string;
  patient_phone: string;
  patient_channel: string;
  created_by: string;
  created_at: string;
};

const APPOINTMENT_STATUSES = [
  { value: "", label: "Todos os status" },
  { value: "PENDING", label: "Pendente" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "RESCHEDULED", label: "Reagendado" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "NO_SHOW", label: "No Show" },
  { value: "IN_PROGRESS", label: "Em Atendimento" },
  { value: "COMPLETED", label: "Concluído" },
];

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
};

export default function AppointmentsPage() {
  const { activeClinicId, activeClinic } = useClinicContext();
  const {
    data: appointments,
    loading,
    error,
    refetch,
  } = useApi<Appointment[]>(
    activeClinicId ? `/api/admin/clinics/${activeClinicId}/appointments` : "",
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((a) => {
      const matchesStatus = !statusFilter || a.status === statusFilter;
      const matchesSearch =
        !search ||
        a.patient_name.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [appointments, search, statusFilter]);

  const columns: ColumnsType<Appointment> = [
    {
      title: "Paciente",
      dataIndex: "patient_name",
      key: "patient_name",
      ellipsis: true,
      render: (name: string) => (
        <span style={{ fontWeight: 500 }}>{name}</span>
      ),
    },
    {
      title: "Serviço",
      dataIndex: "service_name",
      key: "service_name",
      ellipsis: true,
      responsive: ["md"],
      render: (name: string, record) => (
        <Flex vertical gap={2}>
          <span style={{ fontSize: 13 }}>{name}</span>
          <Tag color="geekblue" style={{ width: "fit-content", fontSize: 11, borderRadius: 4 }}>
            {record.service_code}
          </Tag>
        </Flex>
      ),
    },
    {
      title: "Profissional",
      dataIndex: "professional_name",
      key: "professional_name",
      ellipsis: true,
      responsive: ["lg"],
    },
    {
      title: "Data/Hora",
      dataIndex: "starts_at",
      key: "starts_at",
      width: 160,
      render: (v: string) => (
        <Flex align="center" gap={6}>
          <CalendarOutlined style={{ color: "#94a3b8", fontSize: 12 }} />
          <span style={{ fontSize: 13 }}>{formatDateTime(v)}</span>
        </Flex>
      ),
      sorter: (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      defaultSortOrder: "descend",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: "Criado por",
      dataIndex: "created_by",
      key: "created_by",
      width: 110,
      responsive: ["xl"],
      render: (v: string) => (
        <Tag style={{ borderRadius: 6, fontSize: 12 }}>{v}</Tag>
      ),
    },
  ];

  if (loading) return <LoadingState text="Carregando agendamentos..." />;
  if (error)
    return (
      <ErrorState
        title="Erro ao carregar agendamentos"
        message={error}
        onRetry={refetch}
      />
    );

  return (
    <>
      <PageHeader
        title="Agendamentos"
        subtitle={activeClinic ? `Gerencie os agendamentos da clínica` : "Agendamentos da clínica"}
        actions={
          <Button icon={<ReloadOutlined />} onClick={refetch}>
            Atualizar
          </Button>
        }
      />

      <Card
        style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
        styles={{ body: { padding: 0 } }}
      >
        <Flex gap={12} wrap="wrap" style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <Input
            placeholder="Buscar por paciente..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={APPOINTMENT_STATUSES}
            style={{ width: 180 }}
          />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: "#94a3b8", alignSelf: "center" }}>
            {filtered.length} agendamento{filtered.length !== 1 ? "s" : ""}
          </span>
        </Flex>

        <Table<Appointment>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "30", "50"],
            style: { padding: "0 20px" },
          }}
          scroll={{ x: 600 }}
          locale={{
            emptyText: (
              <Empty description="Nenhum agendamento encontrado" />
            ),
          }}
        />
      </Card>
    </>
  );
}
