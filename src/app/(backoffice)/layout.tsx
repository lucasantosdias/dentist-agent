"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Typography, Flex, Button, Badge, Avatar, Input, Divider, Tooltip } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  CalendarOutlined,
  MessageOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ExperimentOutlined,
  MedicineBoxOutlined,
  UserOutlined,
  PlusOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  SearchOutlined,
  CustomerServiceOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { ClinicProvider } from "@/hooks/useClinicContext";
import { ClinicSelector } from "@/components/ui/ClinicSelector";
import { useSession, signOut } from "next-auth/react";
import { SessionProvider } from "@/components/providers/SessionProvider";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const SIDEBAR_BG = "#0f172a";
const SIDEBAR_DARK = "#0b1120";

const menuItems: MenuProps["items"] = [
  {
    key: "/backoffice",
    icon: <DashboardOutlined />,
    label: "Dashboard",
  },
  {
    key: "/backoffice/appointments",
    icon: <CalendarOutlined />,
    label: "Agendamentos",
  },
  {
    key: "/backoffice/patients",
    icon: <UserOutlined />,
    label: "Pacientes",
  },
  {
    key: "/backoffice/professionals",
    icon: <TeamOutlined />,
    label: "Profissionais",
  },
  {
    key: "/backoffice/services",
    icon: <MedicineBoxOutlined />,
    label: "Serviços",
  },
  {
    key: "/backoffice/conversations",
    icon: <MessageOutlined />,
    label: "Conversas",
  },
  {
    key: "/backoffice/test-mode",
    icon: <ExperimentOutlined />,
    label: "AI Simulador",
  },
  {
    key: "/backoffice/settings",
    icon: <SettingOutlined />,
    label: "Configuracoes",
  },
];

export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const selectedKey = menuItems
    ?.filter((item): item is { key: string } => item !== null && "key" in item && typeof item.key === "string")
    .map((item) => item.key)
    .filter((key) => pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0] || "/backoffice";

  return (
    <SessionProvider>
    <ClinicProvider>
      <Layout style={{ minHeight: "100vh" }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={250}
          collapsedWidth={72}
          className="dark-sidebar"
          style={{
            background: SIDEBAR_BG,
            overflow: "auto",
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Logo */}
          <Flex
            align="center"
            justify={collapsed ? "center" : "flex-start"}
            gap={10}
            style={{
              height: 64,
              padding: collapsed ? "0" : "0 20px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <MedicineBoxOutlined style={{ color: "#fff", fontSize: 16 }} />
            </div>
            {!collapsed && (
              <div style={{ overflow: "hidden" }}>
                <Text strong style={{ fontSize: 16, color: "#fff", display: "block", lineHeight: 1.2 }}>
                  Dentzi
                </Text>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  AI-Powered Clinic
                </Text>
              </div>
            )}
          </Flex>

          {/* Clinic selector */}
          <div style={{ padding: collapsed ? "12px 8px" : "12px 16px", flexShrink: 0 }}>
            <ClinicSelector collapsed={collapsed} />
          </div>

          <Divider style={{ margin: "4px 0", borderColor: "rgba(255,255,255,0.08)" }} />

          {/* Menu */}
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => router.push(key)}
            style={{
              background: "transparent",
              border: "none",
              padding: "4px 0",
              flex: 1,
            }}
          />

          {/* New Appointment CTA */}
          <div style={{ padding: collapsed ? "12px 8px" : "12px 16px", flexShrink: 0 }}>
            {collapsed ? (
              <Tooltip title="Novo Agendamento" placement="right">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{
                    width: "100%",
                    height: 40,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                    border: "none",
                  }}
                />
              </Tooltip>
            ) : (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                block
                style={{
                  height: 40,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                  border: "none",
                  fontWeight: 500,
                }}
              >
                Novo Agendamento
              </Button>
            )}
          </div>

          <Divider style={{ margin: "4px 0", borderColor: "rgba(255,255,255,0.08)" }} />

          {/* Bottom links */}
          <div style={{ padding: collapsed ? "8px" : "8px 16px 16px", flexShrink: 0 }}>
            <Flex
              vertical
              gap={4}
              align={collapsed ? "center" : "flex-start"}
            >
              <Button
                type="text"
                icon={<CustomerServiceOutlined />}
                style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, paddingLeft: collapsed ? 0 : 8 }}
                size="small"
              >
                {!collapsed && "Suporte"}
              </Button>
              <Button
                type="text"
                icon={<LogoutOutlined />}
                style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, paddingLeft: collapsed ? 0 : 8 }}
                size="small"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                {!collapsed && "Sair"}
              </Button>
            </Flex>
          </div>
        </Sider>

        <Layout style={{ marginLeft: collapsed ? 72 : 250, transition: "margin-left 0.2s ease" }}>
          {/* Header */}
          <Header
            style={{
              height: 64,
              padding: "0 24px",
              background: "#fff",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 16,
              position: "sticky",
              top: 0,
              zIndex: 99,
            }}
          >
            {/* Collapse toggle */}
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 36, height: 36 }}
            />

            {/* Search */}
            <Input
              placeholder="Buscar pacientes, agendamentos..."
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              style={{
                maxWidth: 360,
                borderRadius: 8,
                background: "#f8fafc",
                borderColor: "#e2e8f0",
              }}
              allowClear
            />

            <div style={{ flex: 1 }} />

            {/* Right actions */}
            <Flex align="center" gap={8}>
              <Tooltip title="Ajuda">
                <Button
                  type="text"
                  icon={<QuestionCircleOutlined style={{ fontSize: 18, color: "#64748b" }} />}
                  style={{ width: 36, height: 36 }}
                />
              </Tooltip>
              <Tooltip title="Notificações">
                <Badge count={3} size="small" offset={[-4, 4]}>
                  <Button
                    type="text"
                    icon={<BellOutlined style={{ fontSize: 18, color: "#64748b" }} />}
                    style={{ width: 36, height: 36 }}
                  />
                </Badge>
              </Tooltip>
              <Tooltip title="Configurações">
                <Button
                  type="text"
                  icon={<SettingOutlined style={{ fontSize: 18, color: "#64748b" }} />}
                  style={{ width: 36, height: 36 }}
                />
              </Tooltip>
              <Divider orientation="vertical" style={{ height: 24, margin: "0 4px" }} />
              <Flex align="center" gap={8} style={{ cursor: "pointer" }}>
                <Avatar
                  size={34}
                  style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}
                  icon={<UserOutlined />}
                />
                {!collapsed && session?.user && (
                  <div style={{ lineHeight: 1.2 }}>
                    <Text strong style={{ fontSize: 13, display: "block" }}>{session.user.name}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{session.user.role}</Text>
                  </div>
                )}
              </Flex>
            </Flex>
          </Header>

          <Content style={{ padding: 24, overflow: "auto", background: "#f8fafc" }}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </ClinicProvider>
    </SessionProvider>
  );
}
