"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  App,
  Empty,
  Card,
  Avatar,
  Dropdown,
  Typography,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  MoreOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatusTag } from "@/components/ui/StatusTag";
import { ProfessionalForm } from "./_components/ProfessionalForm";
import { ProfessionalDrawer } from "./_components/ProfessionalDrawer";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useClinicContext } from "@/hooks/useClinicContext";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

type Professional = {
  id: string;
  display_name: string;
  specialties: string[];
  email: string | null;
  phone: string | null;
  timezone: string;
  active: boolean;
  role: string;
};

type ClinicService = {
  id: string;
  code: string;
  display_name: string;
  duration_minutes: number;
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
];

export default function ProfessionalsPage() {
  const { message } = App.useApp();
  const { activeClinicId, activeClinic } = useClinicContext();
  const {
    data: professionals,
    loading,
    error,
    refetch,
  } = useApi<Professional[]>(
    activeClinicId
      ? `/api/admin/clinics/${activeClinicId}/professionals`
      : "",
  );

  // Clinic services and specialties
  const [clinicServices, setClinicServices] = useState<ClinicService[]>([]);
  const [specialties, setSpecialties] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    if (!activeClinicId) return;
    api<ClinicService[]>(
      `/api/admin/clinics/${activeClinicId}/services`,
    )
      .then(setClinicServices)
      .catch(() => setClinicServices([]));
    api<Array<{ id: string; name: string }>>(
      `/api/admin/clinics/${activeClinicId}/specialties`,
    )
      .then(setSpecialties)
      .catch(() => setSpecialties([]));
  }, [activeClinicId]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  const filtered = useMemo(() => {
    if (!professionals) return [];
    return professionals.filter((p) => {
      const matchesSearch =
        !search ||
        p.display_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.phone ?? "").includes(search);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" && p.active) ||
        (statusFilter === "inactive" && !p.active);
      const matchesSpecialty =
        !specialtyFilter || p.specialties.includes(specialtyFilter);
      return matchesSearch && matchesStatus && matchesSpecialty;
    });
  }, [professionals, search, statusFilter, specialtyFilter]);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm();

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] =
    useState<Professional | null>(null);

  const openDrawer = (professional: Professional) => {
    setSelectedProfessional(professional);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedProfessional(null);
  };

  // Create professional
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      await api<Professional>("/api/admin/professionals", {
        method: "POST",
        body: {
          display_name: values.display_name,
          specialty_ids: values.specialty_ids || [],
          email: values.email || undefined,
          phone: values.phone || undefined,
          timezone: values.timezone,
          role: values.role || "PROFESSIONAL",
          clinic_id: activeClinicId,
          service_ids: values.service_ids || [],
        },
      });
      message.success("Profissional criado com sucesso!");
      setCreateOpen(false);
      createForm.resetFields();
      refetch();
    } catch (err: unknown) {
      const errorData =
        err && typeof err === "object" && "data" in err
          ? (err as { data: { error?: string } }).data
          : null;
      message.error(errorData?.error ?? "Erro ao criar profissional.");
    } finally {
      setCreating(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (professional: Professional) => {
    try {
      await api(`/api/admin/professionals/${professional.id}`, {
        method: "PATCH",
        body: { active: !professional.active },
      });
      message.success(
        professional.active
          ? "Profissional desativado!"
          : "Profissional ativado!",
      );
      refetch();
    } catch {
      message.error("Erro ao alterar status.");
    }
  };

  // Avatar initials helper
  const getInitials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  // Unique specialties for filter dropdown
  const specialtyOptions = useMemo(() => {
    if (!professionals) return [];
    const all = new Set(professionals.flatMap((p) => p.specialties));
    return [
      { value: "", label: "Todas" },
      ...Array.from(all).map((s) => ({ value: s, label: s })),
    ];
  }, [professionals]);

  // Table columns
  const columns: ColumnsType<Professional> = [
    {
      title: "Profissional",
      key: "name",
      ellipsis: true,
      render: (_, record) => (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Avatar
            size={36}
            style={{
              background: "linear-gradient(135deg, #2563eb, #3b82f6)",
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {getInitials(record.display_name)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ display: "block", fontSize: 14 }} ellipsis>
              {record.display_name}
            </Text>
            {record.email && (
              <Text
                type="secondary"
                style={{ fontSize: 12, display: "block" }}
                ellipsis
              >
                {record.email}
              </Text>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Especialidades",
      dataIndex: "specialties",
      key: "specialties",
      width: 200,
      responsive: ["md"],
      render: (v: string[]) =>
        v.length > 0 ? (
          v.map((s) => (
            <Tag key={s} style={{ marginBottom: 2 }}>
              {s}
            </Tag>
          ))
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Papel",
      dataIndex: "role",
      key: "role",
      width: 120,
      responsive: ["lg"],
      render: (v: string) => (
        <Tag color={v === "CLINIC_MANAGER" ? "gold" : "blue"}>
          {v === "CLINIC_MANAGER" ? "Gestor" : "Profissional"}
        </Tag>
      ),
    },
    {
      title: "Telefone",
      dataIndex: "phone",
      key: "phone",
      width: 160,
      responsive: ["lg"],
      render: (v: string | null) =>
        v ? <Text>{v}</Text> : <Text type="secondary">—</Text>,
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
      title: "",
      key: "actions",
      width: 48,
      onCell: () => ({ onClick: (e: React.MouseEvent) => e.stopPropagation() }),
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              {
                key: "edit",
                icon: <EditOutlined />,
                label: "Editar",
                onClick: () => openDrawer(record),
              },
              {
                key: "toggle",
                icon: record.active ? (
                  <StopOutlined />
                ) : (
                  <CheckCircleOutlined />
                ),
                label: record.active ? "Desativar" : "Ativar",
                onClick: () => handleToggleActive(record),
              },
            ],
          }}
          trigger={["click"]}
        >
          <Button
            type="text"
            icon={<MoreOutlined />}
            style={{ width: 32, height: 32 }}
          />
        </Dropdown>
      ),
    },
  ];

  // Render
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
        subtitle={
          activeClinic
            ? `${activeClinic.name} — Gerencie os profissionais e seus horarios`
            : "Gerencie os profissionais e seus horarios"
        }
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

      {/* Filters */}
      <Card
        style={{
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          marginBottom: 16,
        }}
        styles={{ body: { padding: "12px 16px" } }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ maxWidth: 320, borderRadius: 8 }}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            style={{ width: 130 }}
            placeholder="Status"
          />
          {specialtyOptions.length > 1 && (
            <Select
              value={specialtyFilter}
              onChange={setSpecialtyFilter}
              options={specialtyOptions}
              style={{ width: 180 }}
              placeholder="Especialidade"
            />
          )}
          <Text type="secondary" style={{ fontSize: 13, marginLeft: "auto" }}>
            {filtered.length}{" "}
            {filtered.length === 1 ? "profissional" : "profissionais"}
          </Text>
        </div>
      </Card>

      {/* Table */}
      <Card
        style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
        styles={{ body: { padding: 0 } }}
      >
        <Table<Professional>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
          }}
          scroll={{ x: 600 }}
          locale={{
            emptyText: (
              <Empty description="Nenhum profissional encontrado" />
            ),
          }}
          onRow={(record) => ({
            style: { cursor: "pointer" },
            onClick: () => openDrawer(record),
          })}
        />
      </Card>

      {/* Create Modal */}
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
        width={520}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            timezone: "America/Sao_Paulo",
            role: "PROFESSIONAL",
          }}
        >
          <ProfessionalForm
            specialties={specialties}
            clinicServices={clinicServices}
          />
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <ProfessionalDrawer
        professional={selectedProfessional}
        open={drawerOpen}
        onClose={closeDrawer}
        onUpdated={() => {
          refetch();
          if (selectedProfessional) {
            api<Professional[]>(
              `/api/admin/clinics/${activeClinicId}/professionals`,
            ).then((data) => {
              const updated = data.find(
                (p) => p.id === selectedProfessional.id,
              );
              if (updated) setSelectedProfessional(updated);
            }).catch(() => {});
          }
        }}
        clinicId={activeClinicId ?? ""}
        clinicServices={clinicServices}
        specialties={specialties}
      />
    </>
  );
}
