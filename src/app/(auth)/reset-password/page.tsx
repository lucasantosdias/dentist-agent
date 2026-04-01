"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Form, Input, Button, Typography, Alert } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title, Text, Link } = Typography;

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <Alert type="error" title="Link invalido. Solicite um novo." showIcon />
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/forgot-password">Solicitar novo link</Link>
        </div>
      </Card>
    );
  }

  const handleSubmit = async (values: { password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      setError("As senhas nao coincidem");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api("/api/auth/reset-password", { method: "POST", body: { token, password: values.password } });
      router.push("/login?success=password-reset");
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      setError(apiErr.data?.error ?? "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Redefinir senha</Title>
        <Text type="secondary">Escolha uma nova senha</Text>
      </div>

      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}

      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="password" rules={[{ required: true, message: "Informe a nova senha" }, { min: 8, message: "Minimo 8 caracteres" }]}>
          <Input.Password prefix={<LockOutlined style={{ color: "#94a3b8" }} />} placeholder="Nova senha" size="large" />
        </Form.Item>
        <Form.Item name="confirm" rules={[{ required: true, message: "Confirme a senha" }]}>
          <Input.Password prefix={<LockOutlined style={{ color: "#94a3b8" }} />} placeholder="Confirmar senha" size="large" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">Redefinir senha</Button>
        </Form.Item>
        <div style={{ textAlign: "center" }}>
          <Link href="/login">Voltar ao login</Link>
        </div>
      </Form>
    </Card>
  );
}
