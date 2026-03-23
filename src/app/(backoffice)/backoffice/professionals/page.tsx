"use client";

import { useState } from "react";
import {
  Table,
  Button,
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Tag,
  App,
  Empty,
  Card,
  Flex,
  Avatar,
} from "antd";
import {
  PlusOutlined,
  ScheduleOutlined,
  ReloadOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatusTag } from "@/components/ui/StatusTag";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useClinicContext } from "@/hooks/useClinicContext";
import type { ColumnsType } from "antd/es/table";

type Professional = {
  id: string;
  display_name: string;
  specialty: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  active: boolean;
  role: string;
};

type AvailabilityRule = {
  id: string;
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number | null;
  location_id: string | null;
};

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

const weekdayLabel = (day: number): string =>
  WEEKDAYS.find((w) => w.value === day)?.label ?? String(day);

export default function ProfessionalsPage() {
  const { message } = App.useApp();
  const { activeClinicId, activeClinic } = useClinicContext();
  const {
    data: professionals,
    loading,
    error,
    refetch,
  } = useApi<Professional[]>(
    activeClinicId ? `/api/admin/clinics/${activeClinicId}/professionals` : "",
  );

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] =
    useState<Professional | null>(null);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const [ruleFormVisible, setRuleFormVisible] = useState(false);
  const [ruleForm] = Form.useForm();

  // ── Fetch availability rules ──────────────────────────────────────────
  const fetchRules = async (professionalId: string) => {
    setRulesLoading(true);
    try {
      const data = await api<AvailabilityRule[]>(
        `/api/admin/professionals/${professionalId}/availability-rules`,
      );
      setRules(data);
    } catch {
      message.error("Erro ao carregar regras de disponibilidade.");
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  };

  // ── Open drawer ───────────────────────────────────────────────────────
  const openDrawer = (professional: Professional) => {
    setSelectedProfessional(professional);
    setDrawerOpen(true);
    setRuleFormVisible(false);
    ruleForm.resetFields();
    fetchRules(professional.id);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedProfessional(null);
    setRules([]);
    setRuleFormVisible(false);
    ruleForm.resetFields();
  };

  // ── Create professional ───────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      await api<Professional>("/api/admin/professionals", {
        method: "POST",
        body: {
          display_name: values.display_name,
          email: values.email || undefined,
          phone: values.phone || undefined,
          timezone: values.timezone,
        },
      });
      message.success("Profissional criado com sucesso!");
      setCreateOpen(false);
      createForm.resetFields();
      refetch();
    } catch (err: unknown) {
      const errorData = err && typeof err === "object" && "data" in err
        ? (err as { data: { error?: string } }).data
        : null;
      message.error(
        errorData?.error ?? "Erro ao criar profissional.",
      );
    } finally {
      setCreating(false);
    }
  };

  // ── Add availability rule ─────────────────────────────────────────────
  const handleAddRule = async () => {
    if (!selectedProfessional) return;
    try {
      const values = await ruleForm.validateFields();

      // Validate time format HH:mm
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!timeRegex.test(values.start_time)) {
        message.error(
          "Horário de início inválido. Use o formato HH:mm (ex: 08:00).",
        );
        return;
      }
      if (!timeRegex.test(values.end_time)) {
        message.error(
          "Horário de fim inválido. Use o formato HH:mm (ex: 17:00).",
        );
        return;
      }
      if (values.start_time >= values.end_time) {
        message.error("O horário de início deve ser anterior ao horário de fim.");
        return;
      }

      setAddingRule(true);
      await api<AvailabilityRule>(
        `/api/admin/professionals/${selectedProfessional.id}/availability-rules`,
        {
          method: "POST",
          body: {
            weekday: values.weekday,
            start_time: values.start_time,
            end_time: values.end_time,
          },
        },
      );
      message.success("Regra adicionada com sucesso!");
      ruleForm.resetFields();
      setRuleFormVisible(false);
      fetchRules(selectedProfessional.id);
    } catch (err: unknown) {
      const errorData = err && typeof err === "object" && "data" in err
        ? (err as { data: { error?: string } }).data
        : null;
      message.error(
        errorData?.error ?? "Erro ao adicionar regra.",
      );
    } finally {
      setAddingRule(false);
    }
  };

  // ── Table columns ─────────────────────────────────────────────────────
  const columns: ColumnsType<Professional> = [
    {
      title: "Nome",
      dataIndex: "display_name",
      key: "display_name",
      ellipsis: true,
    },
    {
      title: "Especialidade",
      dataIndex: "specialty",
      key: "specialty",
      width: 140,
      responsive: ["md"],
      render: (v: string | null) => v ?? <Tag>—</Tag>,
    },
    {
      title: "Papel",
      dataIndex: "role",
      key: "role",
      width: 130,
      responsive: ["lg"],
      render: (v: string) => (
        <Tag color={v === "CLINIC_MANAGER" ? "gold" : "blue"}>
          {v === "CLINIC_MANAGER" ? "Gestor" : "Profissional"}
        </Tag>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      ellipsis: true,
      responsive: ["xl"],
      render: (v: string | null) => v ?? <Tag>—</Tag>,
    },
    {
      title: "Telefone",
      dataIndex: "phone",
      key: "phone",
      responsive: ["lg"],
      render: (v: string | null) => v ?? <Tag>—</Tag>,
    },
    {
      title: "Fuso",
      dataIndex: "timezone",
      key: "timezone",
      responsive: ["xl"],
    },
    {
      title: "Status",
      dataIndex: "active",
      key: "active",
      width: 100,
      render: (active: boolean) => (
        <StatusTag status={active ? "ACTIVE" : "INACTIVE"} />
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Button
          type="link"
          icon={<ScheduleOutlined />}
          onClick={() => openDrawer(record)}
        >
          Ver Horários
        </Button>
      ),
    },
  ];

  // ── Rules table columns ───────────────────────────────────────────────
  const ruleColumns: ColumnsType<AvailabilityRule> = [
    {
      title: "Dia da Semana",
      dataIndex: "weekday",
      key: "weekday",
      render: (v: number) => weekdayLabel(v),
      sorter: (a, b) => a.weekday - b.weekday,
    },
    {
      title: "Início",
      dataIndex: "start_time",
      key: "start_time",
    },
    {
      title: "Fim",
      dataIndex: "end_time",
      key: "end_time",
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) return <LoadingState text="Carregando profissionais..." />;
  if (error)
    return (
      <ErrorState
        title="Erro ao carregar profissionais"
        message={error}
        onRetry={refetch}
      />
    );

  return (
    <>
      <PageHeader
        title="Profissionais"
        subtitle={activeClinic ? `${activeClinic.name} — Gerencie os profissionais e seus horários` : "Gerencie os profissionais e seus horários"}
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={refetch}>
              Atualizar
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.resetFields();
                setCreateOpen(true);
              }}
            >
              Novo Profissional
            </Button>
          </Space>
        }
      />

      <Card
        style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
        styles={{ body: { padding: 0 } }}
      >
        <Table<Professional>
          rowKey="id"
          columns={columns}
          dataSource={professionals ?? []}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 600 }}
          locale={{ emptyText: <Empty description="Nenhum profissional cadastrado" /> }}
        />
      </Card>

      {/* ── Create Professional Modal ──────────────────────────────────── */}
      <Modal
        title="Novo Profissional"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="Criar"
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ timezone: "America/Sao_Paulo" }}
        >
          <Form.Item
            name="display_name"
            label="Nome"
            rules={[{ required: true, message: "Nome é obrigatório" }]}
          >
            <Input placeholder="Dr. João Silva" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" placeholder="joao@clinica.com" />
          </Form.Item>
          <Form.Item name="phone" label="Telefone">
            <Input placeholder="+55 11 99999-9999" />
          </Form.Item>
          <Form.Item
            name="timezone"
            label="Fuso Horário"
            rules={[{ required: true, message: "Fuso horário é obrigatório" }]}
          >
            <Input placeholder="America/Sao_Paulo" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Availability Rules Drawer ──────────────────────────────────── */}
      <Drawer
        title={
          selectedProfessional
            ? `Horários — ${selectedProfessional.display_name}`
            : "Horários"
        }
        open={drawerOpen}
        onClose={closeDrawer}
        width={560}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() =>
                selectedProfessional && fetchRules(selectedProfessional.id)
              }
              disabled={!selectedProfessional}
            >
              Atualizar
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                ruleForm.resetFields();
                setRuleFormVisible(true);
              }}
            >
              Adicionar Regra
            </Button>
          </Space>
        }
      >
        {/* Add rule form */}
        {ruleFormVisible && (
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              background: "#fafafa",
              borderRadius: 8,
              border: "1px solid #f0f0f0",
            }}
          >
            <Form form={ruleForm} layout="vertical">
              <Form.Item
                name="weekday"
                label="Dia da Semana"
                rules={[
                  { required: true, message: "Selecione o dia da semana" },
                ]}
              >
                <Select
                  placeholder="Selecione..."
                  options={WEEKDAYS}
                />
              </Form.Item>
              <Form.Item
                name="start_time"
                label="Horário de Início"
                rules={[
                  { required: true, message: "Horário de início é obrigatório" },
                ]}
              >
                <Input placeholder="08:00" />
              </Form.Item>
              <Form.Item
                name="end_time"
                label="Horário de Fim"
                rules={[
                  { required: true, message: "Horário de fim é obrigatório" },
                ]}
              >
                <Input placeholder="17:00" />
              </Form.Item>
              <Space>
                <Button
                  type="primary"
                  onClick={handleAddRule}
                  loading={addingRule}
                >
                  Salvar
                </Button>
                <Button
                  onClick={() => {
                    setRuleFormVisible(false);
                    ruleForm.resetFields();
                  }}
                >
                  Cancelar
                </Button>
              </Space>
            </Form>
          </div>
        )}

        {/* Rules table */}
        <Table<AvailabilityRule>
          rowKey="id"
          columns={ruleColumns}
          dataSource={rules}
          loading={rulesLoading}
          pagination={false}
          size="small"
          locale={{
            emptyText: (
              <Empty description="Nenhuma regra de disponibilidade cadastrada" />
            ),
          }}
        />
      </Drawer>
    </>
  );
}
