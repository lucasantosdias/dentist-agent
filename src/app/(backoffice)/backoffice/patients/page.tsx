"use client";

import { useState, useMemo } from "react";
import { Table, Input, Select, Flex, Button, Empty, Tag, Avatar, Card } from "antd";
import { ReloadOutlined, SearchOutlined, PlusOutlined, UserOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusTag } from "@/components/ui/StatusTag";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useApi } from "@/hooks/useApi";
import { useClinicContext } from "@/hooks/useClinicContext";
import type { ColumnsType } from "antd/es/table";

type Patient = {
  id: string;
  full_name: string | null;
  phone_e164: string | null;
  email: string | null;
  default_channel: string;
  state: string;
  last_interaction_at: string | null;
  created_at: string;
};

const STATE_OPTIONS = [
  { value: "", label: "Todos os estados" },
  { value: "LEAD_NEW", label: "Lead Novo" },
  { value: "LEAD_QUALIFIED", label: "Lead Qualificado" },
  { value: "LEAD_INACTIVE", label: "Lead Inativo" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "INACTIVE", label: "Inativo" },
];

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
};

const getInitials = (name: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const AVATAR_COLORS = ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ca8a04"];

export default function PatientsPage() {
  const { activeClinicId, activeClinic } = useClinicContext();
  const {
    data: patients,
    loading,
    error,
    refetch,
  } = useApi<Patient[]>(
    activeClinicId ? `/api/admin/clinics/${activeClinicId}/patients` : "",
  );

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  const filtered = useMemo(() => {
    if (!patients) return [];
    return patients.filter((p) => {
      const matchesState = !stateFilter || p.state === stateFilter;
      const matchesSearch =
        !search ||
        (p.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.phone_e164 ?? "").includes(search);
      return matchesState && matchesSearch;
    });
  }, [patients, search, stateFilter]);

  const columns: ColumnsType<Patient> = [
    {
      title: "Paciente",
      dataIndex: "full_name",
      key: "full_name",
      ellipsis: true,
      render: (name: string | null, record) => (
        <Flex align="center" gap={12}>
          <Avatar
            size={36}
            style={{
              background: AVATAR_COLORS[record.id.charCodeAt(0) % AVATAR_COLORS.length],
              fontWeight: 600,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {getInitials(name)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 14, lineHeight: 1.3 }}>{name ?? "—"}</div>
            {record.email && (
              <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {record.email}
              </div>
            )}
          </div>
        </Flex>
      ),
    },
    {
      title: "Contato",
      dataIndex: "phone_e164",
      key: "phone_e164",
      width: 160,
      responsive: ["md"],
      render: (v: string | null) => (
        <span style={{ fontSize: 13, color: "#475569" }}>{v ?? "—"}</span>
      ),
    },
    {
      title: "Canal",
      dataIndex: "default_channel",
      key: "default_channel",
      width: 110,
      responsive: ["lg"],
      render: (v: string) => (
        <Tag style={{ borderRadius: 6, fontSize: 12 }}>{v}</Tag>
      ),
    },
    {
      title: "Estado",
      dataIndex: "state",
      key: "state",
      width: 130,
      render: (state: string) => <StatusTag status={state} />,
    },
    {
      title: "Últ. Interação",
      dataIndex: "last_interaction_at",
      key: "last_interaction_at",
      width: 160,
      responsive: ["lg"],
      render: (v: string | null) => (
        <span style={{ fontSize: 13, color: "#64748b" }}>{formatDate(v)}</span>
      ),
      sorter: (a, b) => {
        const da = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
        const db = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
        return da - db;
      },
    },
    {
      title: "Criado em",
      dataIndex: "created_at",
      key: "created_at",
      width: 140,
      responsive: ["xl"],
      render: (v: string) => (
        <span style={{ fontSize: 13, color: "#64748b" }}>{formatDate(v)}</span>
      ),
    },
  ];

  if (loading) return <LoadingState text="Carregando pacientes..." />;
  if (error)
    return (
      <ErrorState
        title="Erro ao carregar pacientes"
        message={error}
        onRetry={refetch}
      />
    );

  return (
    <>
      <PageHeader
        title="Diretório de Pacientes"
        subtitle={activeClinic ? `Gerencie registros, histórico e procedimentos dos pacientes` : "Registros de pacientes"}
        actions={
          <Flex gap={8}>
            <Button icon={<ReloadOutlined />} onClick={refetch}>
              Atualizar
            </Button>
            <Button type="primary" icon={<PlusOutlined />}>
              Adicionar Paciente
            </Button>
          </Flex>
        }
      />

      <Card
        style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
        styles={{ body: { padding: 0 } }}
      >
        <Flex gap={12} wrap="wrap" style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 320 }}
          />
          <Select
            value={stateFilter}
            onChange={setStateFilter}
            options={STATE_OPTIONS}
            style={{ width: 180 }}
          />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: "#94a3b8", alignSelf: "center" }}>
            Mostrando {filtered.length} de {patients?.length ?? 0} pacientes
          </span>
        </Flex>

        <Table<Patient>
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
            emptyText: <Empty description="Nenhum paciente encontrado" />,
          }}
          style={{ borderRadius: 0 }}
        />
      </Card>
    </>
  );
}
