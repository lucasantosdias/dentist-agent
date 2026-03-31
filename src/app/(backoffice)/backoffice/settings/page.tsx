"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  Input,
  Space,
  Tag,
  App,
  Empty,
  Form,
  InputNumber,
  Table,
  Tabs,
  Flex,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  MedicineBoxOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { api } from "@/lib/api";
import { useClinicContext } from "@/hooks/useClinicContext";
import type { ColumnsType } from "antd/es/table";

type Specialty = {
  id: string;
  name: string;
};

type Service = {
  id: string;
  code: string;
  display_name: string;
  description: string | null;
  duration_minutes: number;
  price: number | string | null;
  active: boolean;
};

const formatPrice = (price: number | string | null): string => {
  if (price === null || price === undefined) return "--";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (num === 0) return "Gratuito";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
};

export default function SettingsPage() {
  const { message } = App.useApp();
  const { activeClinicId, activeClinic } = useClinicContext();

  // ── Specialties state ─────────────────────────────────────
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [newSpecialty, setNewSpecialty] = useState("");
  const [loadingSpecialties, setLoadingSpecialties] = useState(true);
  const [addingSpecialty, setAddingSpecialty] = useState(false);

  // ── Services state ────────────────────────────────────────
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [creatingService, setCreatingService] = useState(false);
  const [serviceFormVisible, setServiceFormVisible] = useState(false);
  const [serviceForm] = Form.useForm();

  // ── Load data ─────────────────────────────────────────────
  const fetchSpecialties = useCallback(async () => {
    if (!activeClinicId) return;
    setLoadingSpecialties(true);
    try {
      const data = await api<Specialty[]>(
        `/api/admin/clinics/${activeClinicId}/specialties`,
      );
      setSpecialties(data);
    } catch {
      message.error("Erro ao carregar especialidades.");
    } finally {
      setLoadingSpecialties(false);
    }
  }, [activeClinicId, message]);

  const fetchServices = useCallback(async () => {
    if (!activeClinicId) return;
    setLoadingServices(true);
    try {
      const data = await api<Service[]>(
        `/api/admin/clinics/${activeClinicId}/services`,
      );
      setServices(data);
    } catch {
      message.error("Erro ao carregar servicos.");
    } finally {
      setLoadingServices(false);
    }
  }, [activeClinicId, message]);

  useEffect(() => {
    fetchSpecialties();
    fetchServices();
  }, [fetchSpecialties, fetchServices]);

  // ── Specialties handlers ──────────────────────────────────
  const addSpecialty = async () => {
    const trimmed = newSpecialty.trim();
    if (!trimmed || !activeClinicId) return;

    setAddingSpecialty(true);
    try {
      const created = await api<Specialty>(
        `/api/admin/clinics/${activeClinicId}/specialties`,
        { method: "POST", body: { name: trimmed } },
      );
      setSpecialties((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSpecialty("");
      message.success("Especialidade adicionada!");
    } catch (err: unknown) {
      const errorData = err && typeof err === "object" && "data" in err
        ? (err as { data: { error?: string } }).data
        : null;
      message.error(errorData?.error ?? "Erro ao adicionar especialidade.");
    } finally {
      setAddingSpecialty(false);
    }
  };

  const removeSpecialty = async (id: string) => {
    if (!activeClinicId) return;
    try {
      await api(
        `/api/admin/clinics/${activeClinicId}/specialties?id=${id}`,
        { method: "DELETE" },
      );
      setSpecialties((prev) => prev.filter((s) => s.id !== id));
      message.success("Especialidade removida.");
    } catch {
      message.error("Erro ao remover especialidade.");
    }
  };

  // ── Service handlers ──────────────────────────────────────
  const handleCreateService = async () => {
    if (!activeClinicId) return;
    try {
      const values = await serviceForm.validateFields();
      setCreatingService(true);
      await api<Service>(`/api/admin/clinics/${activeClinicId}/services`, {
        method: "POST",
        body: {
          code: values.code,
          display_name: values.display_name,
          description: values.description || undefined,
          duration_minutes: values.duration_minutes,
          price: values.price ?? 0,
        },
      });
      message.success("Servico criado com sucesso!");
      serviceForm.resetFields();
      setServiceFormVisible(false);
      fetchServices();
    } catch (err: unknown) {
      const errorData = err && typeof err === "object" && "data" in err
        ? (err as { data: { error?: string } }).data
        : null;
      message.error(errorData?.error ?? "Erro ao criar servico.");
    } finally {
      setCreatingService(false);
    }
  };

  // ── Service table columns ─────────────────────────────────
  const serviceColumns: ColumnsType<Service> = [
    {
      title: "Servico",
      dataIndex: "display_name",
      key: "display_name",
      ellipsis: true,
      render: (name: string) => (
        <Flex align="center" gap={10}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8, background: "#eff6ff",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <MedicineBoxOutlined style={{ color: "#2563eb", fontSize: 14 }} />
          </div>
          <span style={{ fontWeight: 500 }}>{name}</span>
        </Flex>
      ),
    },
    {
      title: "Codigo",
      dataIndex: "code",
      key: "code",
      width: 160,
      render: (v: string) => <Tag color="geekblue" style={{ borderRadius: 6 }}>{v}</Tag>,
    },
    {
      title: "Duracao",
      dataIndex: "duration_minutes",
      key: "duration_minutes",
      width: 100,
      render: (v: number) => <Tag style={{ borderRadius: 6 }}>{v} min</Tag>,
    },
    {
      title: "Preco",
      dataIndex: "price",
      key: "price",
      width: 130,
      render: (v: number | string | null) => (
        <span style={{ fontWeight: 500 }}>{formatPrice(v)}</span>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────
  if (loadingSpecialties && loadingServices) {
    return <LoadingState text="Carregando configuracoes..." />;
  }

  return (
    <>
      <PageHeader
        title="Configuracoes da Clinica"
        subtitle={activeClinic ? activeClinic.name : "Configuracoes gerais"}
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => { fetchSpecialties(); fetchServices(); }}>
            Atualizar
          </Button>
        }
      />

      <Tabs
        defaultActiveKey="specialties"
        items={[
          {
            key: "specialties",
            label: (
              <span><TagOutlined /> Especialidades</span>
            ),
            children: (
              <Card style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <p style={{ color: "#64748b", marginBottom: 16 }}>
                  Cadastre as especialidades oferecidas pela clinica. Elas aparecerao como opcoes ao cadastrar profissionais.
                </p>

                <Space style={{ marginBottom: 16 }}>
                  <Input
                    placeholder="Ex: Ortodontia, Endodontia, Implantodontia..."
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    onPressEnter={addSpecialty}
                    style={{ width: 350 }}
                    disabled={addingSpecialty}
                  />
                  <Button
                    icon={<PlusOutlined />}
                    onClick={addSpecialty}
                    loading={addingSpecialty}
                    disabled={!newSpecialty.trim()}
                  >
                    Adicionar
                  </Button>
                </Space>

                <div style={{ minHeight: 40 }}>
                  {specialties.length === 0 ? (
                    <Empty description="Nenhuma especialidade cadastrada" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <Flex wrap gap={8}>
                      {specialties.map((s) => (
                        <Tag
                          key={s.id}
                          closable
                          onClose={() => removeSpecialty(s.id)}
                          style={{ fontSize: 14, padding: "4px 12px", borderRadius: 6 }}
                        >
                          {s.name}
                        </Tag>
                      ))}
                    </Flex>
                  )}
                </div>
              </Card>
            ),
          },
          {
            key: "services",
            label: (
              <span><MedicineBoxOutlined /> Servicos</span>
            ),
            children: (
              <Card style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <p style={{ color: "#64748b", marginBottom: 16 }}>
                  Gerencie os servicos/procedimentos da clinica. Eles aparecerao como opcoes ao cadastrar profissionais e no fluxo de agendamento.
                </p>

                <Space style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      serviceForm.resetFields();
                      setServiceFormVisible(true);
                    }}
                  >
                    Novo Servico
                  </Button>
                </Space>

                {serviceFormVisible && (
                  <div
                    style={{
                      marginBottom: 24, padding: 16, background: "#fafafa",
                      borderRadius: 8, border: "1px solid #f0f0f0",
                    }}
                  >
                    <Form form={serviceForm} layout="vertical">
                      <Form.Item
                        name="display_name"
                        label="Nome do Servico"
                        rules={[{ required: true, message: "Nome e obrigatorio" }]}
                      >
                        <Input placeholder="Limpeza Dental" />
                      </Form.Item>
                      <Form.Item
                        name="code"
                        label="Codigo"
                        rules={[{ required: true, message: "Codigo e obrigatorio" }]}
                        extra="Identificador unico (ex: LIMPEZA, AVALIACAO, CLAREAMENTO)"
                      >
                        <Input placeholder="LIMPEZA" style={{ textTransform: "uppercase" }} />
                      </Form.Item>
                      <Flex gap={16}>
                        <Form.Item
                          name="duration_minutes"
                          label="Duracao (minutos)"
                          rules={[{ required: true, message: "Duracao e obrigatoria" }]}
                          style={{ flex: 1 }}
                        >
                          <InputNumber min={5} max={480} step={5} placeholder="30" style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item
                          name="price"
                          label="Preco (R$)"
                          style={{ flex: 1 }}
                        >
                          <InputNumber min={0} step={10} placeholder="150.00" style={{ width: "100%" }} />
                        </Form.Item>
                      </Flex>
                      <Form.Item name="description" label="Descricao">
                        <Input.TextArea rows={2} placeholder="Descricao do procedimento..." />
                      </Form.Item>
                      <Space>
                        <Button
                          type="primary"
                          onClick={handleCreateService}
                          loading={creatingService}
                        >
                          Criar Servico
                        </Button>
                        <Button onClick={() => { setServiceFormVisible(false); serviceForm.resetFields(); }}>
                          Cancelar
                        </Button>
                      </Space>
                    </Form>
                  </div>
                )}

                <Table<Service>
                  rowKey="id"
                  columns={serviceColumns}
                  dataSource={services}
                  loading={loadingServices}
                  pagination={false}
                  scroll={{ x: 500 }}
                  locale={{ emptyText: <Empty description="Nenhum servico cadastrado" /> }}
                />
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}
