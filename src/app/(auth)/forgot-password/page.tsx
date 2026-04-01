"use client";

import { useState } from "react";
import { Card, Form, Input, Button, Typography, Alert } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title, Text, Link } = Typography;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (values: { email: string }) => {
    setLoading(true);
    try {
      await api("/api/auth/forgot-password", { method: "POST", body: { email: values.email } });
    } catch {
      // Ignore — don't leak info
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Esqueci minha senha</Title>
        <Text type="secondary">Informe seu email para receber o link de recuperacao</Text>
      </div>

      {sent ? (
        <>
          <Alert type="success" message="Se o email estiver cadastrado, voce recebera um link de recuperacao." showIcon style={{ marginBottom: 16 }} />
          <div style={{ textAlign: "center" }}>
            <Link href="/login">Voltar ao login</Link>
          </div>
        </>
      ) : (
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="email" rules={[{ required: true, message: "Informe seu email" }, { type: "email", message: "Email invalido" }]}>
            <Input prefix={<MailOutlined style={{ color: "#94a3b8" }} />} placeholder="Email" size="large" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">Enviar link</Button>
          </Form.Item>
          <div style={{ textAlign: "center" }}>
            <Link href="/login">Voltar ao login</Link>
          </div>
        </Form>
      )}
    </Card>
  );
}
