"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Drawer,
  Tabs,
  Form,
  Button,
  Avatar,
  Tag,
  Space,
  Switch,
  App,
  Select,
  TimePicker,
  Typography,
} from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { ProfessionalForm } from "./ProfessionalForm";
import { WeeklyScheduleGrid } from "./WeeklyScheduleGrid";
import { ProfessionalServicesTab } from "./ProfessionalServicesTab";
import { GoogleCalendarTab } from "./GoogleCalendarTab";
import { api } from "@/lib/api";

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

type Specialty = {
  id: string;
  name: string;
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
  { value: 2, label: "Terca" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sabado" },
];

type ProfessionalDrawerProps = {
  professional: Professional | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  clinicId: string;
  clinicServices: ClinicService[];
  specialties: Specialty[];
};

export function ProfessionalDrawer({
  professional,
  open,
  onClose,
  onUpdated,
  clinicId,
  clinicServices,
  specialties,
}: ProfessionalDrawerProps) {
  const { message } = App.useApp();
  const [editForm] = Form.useForm();
  const [ruleForm] = Form.useForm();

  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleFormVisible, setRuleFormVisible] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const fetchRules = useCallback(
    async (profId: string) => {
      setRulesLoading(true);
      try {
        const data = await api<AvailabilityRule[]>(
          `/api/admin/professionals/${profId}/availability-rules`,
        );
        setRules(data);
      } catch {
        message.error("Erro ao carregar regras de disponibilidade.");
        setRules([]);
      } finally {
        setRulesLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    if (professional && open) {
      const specialtyIds = specialties
        .filter((s) => professional.specialties.includes(s.name))
        .map((s) => s.id);

      editForm.setFieldsValue({
        display_name: professional.display_name,
        email: professional.email ?? "",
        phone: professional.phone ?? "",
        role: professional.role,
        timezone: professional.timezone,
        specialty_ids: specialtyIds,
      });
      setActiveTab("profile");
      setRuleFormVisible(false);
      ruleForm.resetFields();
      fetchRules(professional.id);
    }
  }, [professional, open, editForm, ruleForm, fetchRules, specialties]);

  const handleSaveProfile = async () => {
    if (!professional) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      await api(`/api/admin/professionals/${professional.id}`, {
        method: "PATCH",
        body: {
          display_name: values.display_name,
          email: values.email || null,
          phone: values.phone || null,
          role: values.role,
          timezone: values.timezone,
          specialty_ids: values.specialty_ids || [],
          clinic_id: clinicId,
        },
      });
      message.success("Profissional atualizado com sucesso!");
      onUpdated();
    } catch {
      message.error("Erro ao atualizar profissional.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (active: boolean) => {
    if (!professional) return;
    try {
      await api(`/api/admin/professionals/${professional.id}`, {
        method: "PATCH",
        body: { active },
      });
      message.success(active ? "Profissional ativado!" : "Profissional desativado!");
      onUpdated();
    } catch {
      message.error("Erro ao alterar status.");
    }
  };

  const handleAddRule = async () => {
    if (!professional) return;
    try {
      const values = await ruleForm.validateFields();
      const startTime = values.start_time.format("HH:mm");
      const endTime = values.end_time.format("HH:mm");

      if (startTime >= endTime) {
        message.error("O horario de inicio deve ser anterior ao horario de fim.");
        return;
      }

      setAddingRule(true);
      await api(
        `/api/admin/professionals/${professional.id}/availability-rules`,
        {
          method: "POST",
          body: {
            weekday: values.weekday,
            start_time: startTime,
            end_time: endTime,
          },
        },
      );
      message.success("Regra adicionada com sucesso!");
      ruleForm.resetFields();
      setRuleFormVisible(false);
      fetchRules(professional.id);
    } catch {
      message.error("Erro ao adicionar regra.");
    } finally {
      setAddingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!professional) return;
    try {
      await api(
        `/api/admin/professionals/${professional.id}/availability-rules/${ruleId}`,
        { method: "DELETE" },
      );
      message.success("Regra removida!");
      fetchRules(professional.id);
    } catch {
      message.error("Erro ao remover regra.");
    }
  };

  const initials = professional?.display_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() ?? "";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={640}
      title={null}
      styles={{
        header: { display: "none" },
        body: { padding: 0 },
      }}
      destroyOnClose
    >
      {professional && (
        <>
          {/* Header */}
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <Avatar
              size={48}
              style={{
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                fontSize: 18,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Text
                  strong
                  style={{ fontSize: 16 }}
                  ellipsis
                >
                  {professional.display_name}
                </Text>
                <Tag
                  color={professional.role === "CLINIC_MANAGER" ? "gold" : "blue"}
                >
                  {professional.role === "CLINIC_MANAGER"
                    ? "Gestor"
                    : "Profissional"}
                </Tag>
              </div>
              {professional.email && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {professional.email}
                </Text>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {professional.active ? "Ativo" : "Inativo"}
              </Text>
              <Switch
                checked={professional.active}
                onChange={handleToggleActive}
                size="small"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{ padding: "0 24px" }}
            items={[
              {
                key: "profile",
                label: "Perfil",
                children: (
                  <Form
                    form={editForm}
                    layout="vertical"
                    style={{ paddingBottom: 24 }}
                  >
                    <ProfessionalForm
                      specialties={specialties}
                      clinicServices={[]}
                    />
                    <Button
                      type="primary"
                      onClick={handleSaveProfile}
                      loading={saving}
                      style={{ marginTop: 8 }}
                    >
                      Salvar Alteracoes
                    </Button>
                  </Form>
                ),
              },
              {
                key: "availability",
                label: "Disponibilidade",
                children: (
                  <div style={{ paddingBottom: 24 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                        marginBottom: 16,
                      }}
                    >
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => fetchRules(professional.id)}
                        size="small"
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
                        size="small"
                      >
                        Adicionar Regra
                      </Button>
                    </div>

                    {ruleFormVisible && (
                      <div
                        style={{
                          marginBottom: 20,
                          padding: 16,
                          background: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <Form form={ruleForm} layout="vertical">
                          <Form.Item
                            name="weekday"
                            label="Dia da Semana"
                            rules={[
                              {
                                required: true,
                                message: "Selecione o dia da semana",
                              },
                            ]}
                          >
                            <Select
                              placeholder="Selecione..."
                              options={WEEKDAYS}
                            />
                          </Form.Item>
                          <div style={{ display: "flex", gap: 12 }}>
                            <Form.Item
                              name="start_time"
                              label="Inicio"
                              rules={[{ required: true, message: "Obrigatorio" }]}
                              style={{ flex: 1 }}
                            >
                              <TimePicker
                                format="HH:mm"
                                minuteStep={15}
                                placeholder="08:00"
                                style={{ width: "100%" }}
                                needConfirm={false}
                              />
                            </Form.Item>
                            <Form.Item
                              name="end_time"
                              label="Fim"
                              rules={[{ required: true, message: "Obrigatorio" }]}
                              style={{ flex: 1 }}
                            >
                              <TimePicker
                                format="HH:mm"
                                minuteStep={15}
                                placeholder="17:00"
                                style={{ width: "100%" }}
                                needConfirm={false}
                              />
                            </Form.Item>
                          </div>
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

                    <WeeklyScheduleGrid
                      rules={rules}
                      onDeleteRule={handleDeleteRule}
                      loading={rulesLoading}
                    />
                  </div>
                ),
              },
              {
                key: "services",
                label: "Servicos",
                children: (
                  <div style={{ paddingBottom: 24 }}>
                    <ProfessionalServicesTab
                      professionalId={professional.id}
                      clinicServices={clinicServices}
                    />
                  </div>
                ),
              },
              {
                key: "google-calendar",
                label: "Google Calendar",
                children: professional ? (
                  <GoogleCalendarTab
                    professional={professional}
                  />
                ) : null,
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}
