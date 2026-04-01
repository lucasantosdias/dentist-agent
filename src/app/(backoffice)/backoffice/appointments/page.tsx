"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { Table, Input, Select, Flex, Button, Space, Empty, Card, Tag, Modal, Form, DatePicker, App } from "antd";
import { ReloadOutlined, SearchOutlined, CalendarOutlined, PlusOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import dayjs from "dayjs";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusTag } from "@/components/ui/StatusTag";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useApi } from "@/hooks/useApi";
import { useClinicContext } from "@/hooks/useClinicContext";
import { useSearchParams, useRouter } from "next/navigation";
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
  return (
    <Suspense>
      <AppointmentsContent />
    </Suspense>
  );
}

function AppointmentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeClinicId, activeClinic } = useClinicContext();
  const {
    data: appointments,
    loading,
    error,
    refetch,
  } = useApi<Appointment[]>(
    activeClinicId ? `/api/admin/clinics/${activeClinicId}/appointments` : "",
  );

  const { message } = App.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm();
  const [patients, setPatients] = useState<Array<{ id: string; full_name: string | null; phone_e164: string | null }>>([]);
  const [professionals, setProfessionals] = useState<Array<{ id: string; display_name: string }>>([]);
  const [services, setServices] = useState<Array<{ id: string; code: string; display_name: string; duration_minutes: number }>>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Auto-open modal when navigated with ?new=true
  useEffect(() => {
    if (searchParams.get("new") === "true" && activeClinicId) {
      openCreateModal();
      // Clean the URL param
      router.replace("/backoffice/appointments");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, activeClinicId]);

  const loadFormData = async () => {
    if (!activeClinicId) return;
    try {
      const [pats, profs, svcs] = await Promise.all([
        api<Array<{ id: string; full_name: string | null; phone_e164: string | null }>>(`/api/admin/clinics/${activeClinicId}/patients`),
        api<Array<{ id: string; display_name: string }>>(`/api/admin/clinics/${activeClinicId}/professionals`),
        api<Array<{ id: string; code: string; display_name: string; duration_minutes: number }>>(`/api/admin/clinics/${activeClinicId}/services`),
      ]);
      setPatients(pats);
      setProfessionals(profs);
      setServices(svcs);
    } catch {
      message.error("Erro ao carregar dados do formulario");
    }
  };

  const handleCreate = async (values: { patient_id: string; professional_id: string; service_code: string; starts_at: dayjs.Dayjs }) => {
    setCreating(true);
    try {
      await api("/api/admin/appointments", {
        method: "POST",
        body: {
          clinic_id: activeClinicId,
          patient_id: values.patient_id,
          professional_id: values.professional_id,
          service_code: values.service_code,
          starts_at: values.starts_at.toISOString(),
        },
      });
      message.success("Agendamento criado com sucesso");
      setCreateOpen(false);
      createForm.resetFields();
      refetch();
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      message.error(apiErr.data?.error ?? "Erro ao criar agendamento");
    } finally {
      setCreating(false);
    }
  };

  const openCreateModal = () => {
    loadFormData();
    setCreateOpen(true);
  };

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
          <Space>
            <Button icon={<ReloadOutlined />} onClick={refetch}>
              Atualizar
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Novo Agendamento
            </Button>
          </Space>
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
      <Modal
        title="Novo Agendamento"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        footer={null}
        destroyOnHidden
        width={520}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="patient_id" label="Paciente" rules={[{ required: true, message: "Selecione o paciente" }]}>
            <Select
              showSearch
              placeholder="Buscar paciente..."
              optionFilterProp="label"
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.full_name ?? "Sem nome"} ${p.phone_e164 ? `(${p.phone_e164})` : ""}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="professional_id" label="Profissional" rules={[{ required: true, message: "Selecione o profissional" }]}>
            <Select
              showSearch
              placeholder="Buscar profissional..."
              optionFilterProp="label"
              options={professionals.map((p) => ({
                value: p.id,
                label: p.display_name,
              }))}
            />
          </Form.Item>

          <Form.Item name="service_code" label="Servico" rules={[{ required: true, message: "Selecione o servico" }]}>
            <Select
              showSearch
              placeholder="Buscar servico..."
              optionFilterProp="label"
              options={services.map((s) => ({
                value: s.code,
                label: `${s.display_name} (${s.duration_minutes} min)`,
              }))}
            />
          </Form.Item>

          <Form.Item name="starts_at" label="Data e hora" rules={[{ required: true, message: "Selecione a data e hora" }]}>
            <DatePicker
              showTime={{ format: "HH:mm", minuteStep: 15 }}
              format="DD/MM/YYYY HH:mm"
              style={{ width: "100%" }}
              placeholder="Selecione data e hora"
              disabledDate={(current) => current && current.isBefore(dayjs(), "day")}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); createForm.resetFields(); }}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={creating}>
                Criar agendamento
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
