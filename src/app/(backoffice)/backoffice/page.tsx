"use client";

import { Card, Col, Row, Statistic, Typography, Empty, Flex, Spin, Alert, Avatar, Tag, Button, Divider } from "antd";
import {
  CalendarOutlined,
  TeamOutlined,
  MessageOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  ScheduleOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useClinicContext } from "@/hooks/useClinicContext";
import { useApi } from "@/hooks/useApi";

const { Title, Text, Paragraph } = Typography;

type DashboardStats = {
  clinic: { id: string; name: string };
  professionals_count: number;
  patients_count: number;
  services_count: number;
  appointments_today: number;
  appointments_upcoming: number;
  conversations_active: number;
};

const STAT_CONFIGS = [
  {
    key: "appointments_today",
    title: "Agendamentos Hoje",
    icon: <CalendarOutlined />,
    color: "#2563eb",
    bg: "#eff6ff",
    href: "/backoffice/appointments",
  },
  {
    key: "patients_count",
    title: "Pacientes",
    icon: <UserOutlined />,
    color: "#16a34a",
    bg: "#f0fdf4",
    href: "/backoffice/patients",
  },
  {
    key: "appointments_upcoming",
    title: "Próximos",
    icon: <ScheduleOutlined />,
    color: "#9333ea",
    bg: "#faf5ff",
    href: "/backoffice/appointments",
  },
  {
    key: "conversations_active",
    title: "Conversas Ativas",
    icon: <MessageOutlined />,
    color: "#ea580c",
    bg: "#fff7ed",
    href: "/backoffice/conversations",
  },
  {
    key: "professionals_count",
    title: "Profissionais",
    icon: <TeamOutlined />,
    color: "#0891b2",
    bg: "#ecfeff",
    href: "/backoffice/professionals",
  },
  {
    key: "services_count",
    title: "Serviços",
    icon: <MedicineBoxOutlined />,
    color: "#ca8a04",
    bg: "#fefce8",
    href: "/backoffice/services",
  },
];

const QUICK_ACTIONS = [
  { icon: <PlusOutlined />, label: "Novo Agendamento", color: "#2563eb", bg: "#eff6ff", href: "/backoffice/appointments?new=true" },
  { icon: <UserOutlined />, label: "Pacientes", color: "#16a34a", bg: "#f0fdf4", href: "/backoffice/patients" },
  { icon: <MessageOutlined />, label: "Conversas", color: "#ea580c", bg: "#fff7ed", href: "/backoffice/conversations" },
  { icon: <TeamOutlined />, label: "Profissionais", color: "#9333ea", bg: "#faf5ff", href: "/backoffice/professionals" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { activeClinic, activeClinicId, loading: clinicLoading } = useClinicContext();

  const { data: stats, loading, error } = useApi<DashboardStats>(
    activeClinicId ? `/api/admin/clinics/${activeClinicId}/dashboard` : "",
    undefined,
  );

  if (clinicLoading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: 300 }}>
        <Spin size="large"><div style={{ padding: 50 }} /></Spin>
      </Flex>
    );
  }

  if (!activeClinic) {
    return <Empty description="Nenhuma clínica encontrada. Execute o seed para criar dados de teste." />;
  }

  return (
    <div>
      {/* Page Header */}
      <Flex justify="space-between" align="flex-start" style={{ marginBottom: 28 }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 600 }}>Visão Geral</Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Bom dia! Aqui está o que está acontecendo em {activeClinic.name} hoje.
          </Text>
        </div>
      </Flex>

      {error && (
        <Alert type="error" title={error} style={{ marginBottom: 16 }} showIcon />
      )}

      {loading ? (
        <Flex justify="center" style={{ padding: 60 }}>
          <Spin size="large"><div style={{ padding: 50 }} /></Spin>
        </Flex>
      ) : stats ? (
        <>
          {/* Stats Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {STAT_CONFIGS.map((cfg) => (
              <Col xs={24} sm={12} lg={4} key={cfg.key}>
                <Card
                  className="stat-card"
                  size="small"
                  style={{ borderRadius: 12, border: "1px solid #e2e8f0", cursor: "pointer" }}
                  styles={{ body: { padding: "16px 20px" } }}
                  onClick={() => router.push(cfg.href)}
                >
                  <Flex align="flex-start" justify="space-between">
                    <div>
                      <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3 }}>
                        {cfg.title}
                      </Text>
                      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginTop: 4, color: "#0f172a" }}>
                        {stats[cfg.key as keyof DashboardStats] as number}
                      </div>
                    </div>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: cfg.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        color: cfg.color,
                      }}
                    >
                      {cfg.icon}
                    </div>
                  </Flex>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]}>
            {/* Chart Placeholder */}
            <Col xs={24} lg={16}>
              <Card
                title={
                  <Flex align="center" gap={8}>
                    <RiseOutlined style={{ color: "#2563eb" }} />
                    <span style={{ fontWeight: 600 }}>Performance Semanal</span>
                  </Flex>
                }
                extra={
                  <Flex gap={8}>
                    <Button size="small" type="primary" style={{ borderRadius: 6, fontSize: 12 }}>Semanal</Button>
                    <Button size="small" style={{ borderRadius: 6, fontSize: 12 }}>Mensal</Button>
                  </Flex>
                }
                style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
              >
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Volume de agendamentos relativo ao ciclo anterior
                </Text>
                {/* Chart placeholder - shows a visual representation */}
                <Flex align="flex-end" gap={12} style={{ height: 200, padding: "24px 0 0", marginTop: 16 }}>
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day, i) => {
                    const heights = [45, 65, 55, 80, 70, 30, 15];
                    return (
                      <Flex key={day} vertical align="center" gap={8} style={{ flex: 1 }}>
                        <div
                          style={{
                            width: "100%",
                            maxWidth: 40,
                            height: `${heights[i]}%`,
                            background: i === 3 ? "linear-gradient(180deg, #2563eb, #3b82f6)" : "#e2e8f0",
                            borderRadius: 6,
                            minHeight: 8,
                            transition: "height 0.3s ease",
                          }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>{day}</Text>
                      </Flex>
                    );
                  })}
                </Flex>
              </Card>
            </Col>

            {/* Operations Center */}
            <Col xs={24} lg={8}>
              <Card
                title={
                  <Flex align="center" gap={8}>
                    <ScheduleOutlined style={{ color: "#ea580c" }} />
                    <span style={{ fontWeight: 600 }}>Centro de Operações</span>
                  </Flex>
                }
                style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
              >
                <Row gutter={[12, 12]}>
                  {QUICK_ACTIONS.map((action) => (
                    <Col span={12} key={action.label}>
                      <Button
                        onClick={() => router.push(action.href)}
                        style={{
                          width: "100%",
                          height: 72,
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            background: action.bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: action.color,
                            fontSize: 14,
                          }}
                        >
                          {action.icon}
                        </div>
                        <Text style={{ fontSize: 11, fontWeight: 500 }}>{action.label}</Text>
                      </Button>
                    </Col>
                  ))}
                </Row>

                <Divider style={{ margin: "16px 0" }} />

                {/* Queue */}
                <Flex align="center" justify="space-between" style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 13 }}>
                    <ClockCircleOutlined style={{ marginRight: 6 }} />
                    Fila ({stats.appointments_today})
                  </Text>
                  <Button type="link" size="small" style={{ fontSize: 12, padding: 0 }} onClick={() => router.push("/backoffice/appointments")}>Ver Tudo</Button>
                </Flex>

                <Flex vertical gap={10}>
                  {stats.appointments_today > 0 ? (
                    [1, 2, 3].slice(0, Math.min(stats.appointments_today, 3)).map((i) => (
                      <Flex key={i} align="center" gap={10} style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>
                        <Avatar
                          size={32}
                          style={{ background: ["#eff6ff", "#f0fdf4", "#faf5ff"][i - 1], color: ["#2563eb", "#16a34a", "#9333ea"][i - 1], flexShrink: 0 }}
                        >
                          {["S", "R", "M"][i - 1]}
                        </Avatar>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 13, fontWeight: 500, display: "block" }} ellipsis>
                            {["Paciente Agendado", "Consulta Retorno", "Manutenção"][i - 1]}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {["09:00", "10:30", "11:15"][i - 1]}
                          </Text>
                        </div>
                        <Tag
                          color={["blue", "green", "orange"][i - 1]}
                          style={{ fontSize: 10, margin: 0, borderRadius: 4 }}
                        >
                          {["Agendada", "Confirmada", "Aguardando"][i - 1]}
                        </Tag>
                      </Flex>
                    ))
                  ) : (
                    <Flex justify="center" style={{ padding: 16, opacity: 0.5 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Nenhum agendamento hoje</Text>
                    </Flex>
                  )}
                </Flex>
              </Card>
            </Col>
          </Row>
        </>
      ) : null}
    </div>
  );
}
