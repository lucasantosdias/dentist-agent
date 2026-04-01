"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Form, Input, Button, Typography, Alert, Spin, Tag } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title, Text, Link } = Typography;

type InviteInfo = { valid: boolean; name?: string; email?: string; role?: string };

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInviteInfo({ valid: false });
      setLoading(false);
      return;
    }

    api<InviteInfo>(`/api/auth/validate-invite?token=${token}`)
      .then(setInviteInfo)
      .catch(() => setInviteInfo({ valid: false }))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (values: { password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      setError("As senhas nao coincidem");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api("/api/auth/accept-invite", { method: "POST", body: { token, password: values.password } });
      router.push("/login?success=invite-accepted");
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      setError(apiErr.data?.error ?? "Erro ao criar conta");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card style={{ width: 400, textAlign: "center", padding: 48 }}>
        <Spin size="large" />
      </Card>
    );
  }

  if (!inviteInfo?.valid) {
    return (
      <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <Alert type="error" title="Convite invalido ou expirado" description="Solicite um novo convite ao administrador." showIcon />
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/login">Ir para o login</Link>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Bem-vindo a Dentzi AI</Title>
        <Text type="secondary">Crie sua senha para acessar a plataforma</Text>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <UserOutlined style={{ color: "#64748b" }} />
          <Text strong>{inviteInfo.name}</Text>
        </div>
        <Text type="secondary" style={{ fontSize: 13 }}>{inviteInfo.email}</Text>
        <Tag color="blue" style={{ marginLeft: 8 }}>{inviteInfo.role}</Tag>
      </div>

      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}

      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="password" rules={[{ required: true, message: "Informe a senha" }, { min: 8, message: "Minimo 8 caracteres" }]}>
          <Input.Password prefix={<LockOutlined style={{ color: "#94a3b8" }} />} placeholder="Senha" size="large" />
        </Form.Item>
        <Form.Item name="confirm" rules={[{ required: true, message: "Confirme a senha" }]}>
          <Input.Password prefix={<LockOutlined style={{ color: "#94a3b8" }} />} placeholder="Confirmar senha" size="large" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block size="large">Criar conta</Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
