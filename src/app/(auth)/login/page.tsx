"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Form, Input, Button, Typography, Alert } from "antd";
import { MailOutlined, LockOutlined } from "@ant-design/icons";

const { Title, Text, Link } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/backoffice";
  const success = searchParams.get("success");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      redirect: false,
      email: values.email,
      password: values.password,
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.push(callbackUrl);
  };

  return (
    <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Dentzi AI</Title>
        <Text type="secondary">Entre na sua conta</Text>
      </div>

      {success === "password-reset" && (
        <Alert type="success" message="Senha redefinida com sucesso. Faca login." showIcon style={{ marginBottom: 16 }} />
      )}

      {success === "invite-accepted" && (
        <Alert type="success" message="Conta criada com sucesso. Faca login." showIcon style={{ marginBottom: 16 }} />
      )}

      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
      )}

      <Form layout="vertical" onFinish={handleSubmit} autoComplete="on">
        <Form.Item name="email" rules={[{ required: true, message: "Informe seu email" }, { type: "email", message: "Email invalido" }]}>
          <Input prefix={<MailOutlined style={{ color: "#94a3b8" }} />} placeholder="Email" size="large" autoComplete="email" />
        </Form.Item>

        <Form.Item name="password" rules={[{ required: true, message: "Informe sua senha" }]}>
          <Input.Password prefix={<LockOutlined style={{ color: "#94a3b8" }} />} placeholder="Senha" size="large" autoComplete="current-password" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">Entrar</Button>
        </Form.Item>

        <div style={{ textAlign: "center" }}>
          <Link href="/forgot-password">Esqueci minha senha</Link>
        </div>
      </Form>
    </Card>
  );
}
