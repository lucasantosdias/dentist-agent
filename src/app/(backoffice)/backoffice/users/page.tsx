"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Tag,
  Card,
  Typography,
  Input,
  Modal,
  Form,
  Select,
  App,
  Space,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";

const { Title } = Typography;

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  verified: boolean;
  created_at: string;
  professional_name: string | null;
};

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "red",
  ADMIN: "gold",
  PROFESSIONAL: "blue",
  ATTENDANT: "green",
};

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Administrador",
  PROFESSIONAL: "Profissional",
  ATTENDANT: "Atendente",
};

export default function UsersPage() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [form] = Form.useForm();

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<UserRow[]>("/api/admin/users");
      setUsers(data);
    } catch {
      message.error("Erro ao carregar usuarios");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (ROLE_LABELS[u.role] ?? u.role).toLowerCase().includes(search.toLowerCase()),
  );

  const handleInvite = async (values: { email: string; name: string; role: string }) => {
    setInviting(true);
    try {
      await api("/api/admin/users/invite", {
        method: "POST",
        body: values,
      });
      message.success(`Convite enviado para ${values.email}`);
      setInviteOpen(false);
      form.resetFields();
      loadUsers();
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      message.error(apiErr.data?.error ?? "Erro ao enviar convite");
    } finally {
      setInviting(false);
    }
  };

  // Determine which roles the current user can create
  const creatableRoles = session?.user.role === "SUPERADMIN"
    ? ["SUPERADMIN", "ADMIN", "PROFESSIONAL", "ATTENDANT"]
    : ["PROFESSIONAL", "ATTENDANT"];

  const columns = [
    {
      title: "Nome",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: UserRow) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{record.email}</div>
        </div>
      ),
    },
    {
      title: "Papel",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={ROLE_COLORS[role] ?? "default"}>{ROLE_LABELS[role] ?? role}</Tag>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, record: UserRow) => {
        if (!record.active) {
          return (
            <Tooltip title="Desativado">
              <Tag icon={<StopOutlined />} color="default">Inativo</Tag>
            </Tooltip>
          );
        }
        if (!record.verified) {
          return (
            <Tooltip title="Aguardando aceite do convite">
              <Tag icon={<ClockCircleOutlined />} color="orange">Pendente</Tag>
            </Tooltip>
          );
        }
        return (
          <Tag icon={<CheckCircleOutlined />} color="green">Ativo</Tag>
        );
      },
    },
    {
      title: "Criado em",
      dataIndex: "created_at",
      key: "created_at",
      render: (v: string) => new Date(v).toLocaleDateString("pt-BR"),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Usuarios</Title>
        <Space>
          <Input
            placeholder="Buscar por nome, email ou papel..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={loadUsers} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setInviteOpen(true)}>
            Convidar usuario
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{ emptyText: "Nenhum usuario encontrado" }}
        />
      </Card>

      <Modal
        title="Convidar usuario"
        open={inviteOpen}
        onCancel={() => { setInviteOpen(false); form.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleInvite} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Nome" rules={[{ required: true, message: "Informe o nome" }]}>
            <Input placeholder="Nome completo" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Informe o email" },
              { type: "email", message: "Email invalido" },
            ]}
          >
            <Input placeholder="email@exemplo.com" />
          </Form.Item>
          <Form.Item name="role" label="Papel" rules={[{ required: true, message: "Selecione o papel" }]}>
            <Select
              placeholder="Selecione o papel"
              options={creatableRoles.map((r) => ({
                value: r,
                label: ROLE_LABELS[r] ?? r,
              }))}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={() => { setInviteOpen(false); form.resetFields(); }}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={inviting}>
                Enviar convite
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
