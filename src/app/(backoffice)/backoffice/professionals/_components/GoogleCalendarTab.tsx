"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Space,
  Tag,
  Table,
  Typography,
  Alert,
  Popconfirm,
  App,
  Tooltip,
  Descriptions,
} from "antd";
import {
  MailOutlined,
  WhatsAppOutlined,
  CopyOutlined,
  DisconnectOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";

const { Text, Paragraph } = Typography;

type Professional = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
};

type OutboxRecord = {
  id: string;
  action: string;
  status: string;
  created_at: string;
  appointment_id: string;
  patient_name: string | null;
};

type CalendarStatus = {
  connected: boolean;
  google_calendar_id?: string;
  connected_at?: string;
  last_sync_at?: string | null;
  outbox_history?: OutboxRecord[];
};

type GoogleCalendarTabProps = {
  professional: Professional;
};

const ACTION_LABELS: Record<string, string> = {
  CREATE_EVENT: "Criar evento",
  UPDATE_EVENT: "Atualizar evento",
  CANCEL_EVENT: "Cancelar evento",
};

const STATUS_COLORS: Record<string, string> = {
  DONE: "green",
  FAILED: "red",
  PENDING: "orange",
  PROCESSING: "blue",
};

export function GoogleCalendarTab({ professional }: GoogleCalendarTabProps) {
  const { message } = App.useApp();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<CalendarStatus>(
        `/api/admin/professionals/${professional.id}/google-calendar/status`,
      );
      setStatus(data);
    } catch {
      message.error("Erro ao carregar status do Google Calendar");
    } finally {
      setLoading(false);
    }
  }, [professional.id, message]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleInitiate = async () => {
    try {
      setInitiating(true);
      const data = await api<{ oauth_url: string }>(
        `/api/admin/professionals/${professional.id}/google-calendar/initiate`,
        { method: "POST" },
      );
      setOauthUrl(data.oauth_url);
      message.success("Link de autorizacao gerado");
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      if (apiErr.data?.error === "ALREADY_CONNECTED") {
        message.warning("Este profissional ja possui Google Calendar conectado");
        loadStatus();
      } else {
        message.error("Erro ao gerar link de autorizacao");
      }
    } finally {
      setInitiating(false);
    }
  };

  const handleSendLink = async (channel: "email" | "whatsapp") => {
    if (!oauthUrl) return;
    try {
      setSending(channel);
      await api(`/api/admin/professionals/${professional.id}/google-calendar/send-link`, {
        method: "POST",
        body: { channel, oauth_url: oauthUrl },
      });
      message.success(
        channel === "email"
          ? `Link enviado para ${professional.email}`
          : `Link enviado para ${professional.phone}`,
      );
    } catch {
      message.error(`Erro ao enviar link via ${channel}`);
    } finally {
      setSending(null);
    }
  };

  const handleCopyLink = async () => {
    if (!oauthUrl) return;
    try {
      await navigator.clipboard.writeText(oauthUrl);
      message.success("Link copiado para a area de transferencia");
    } catch {
      message.error("Erro ao copiar link");
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      await api(`/api/admin/professionals/${professional.id}/google-calendar`, {
        method: "DELETE",
      });
      message.success("Google Calendar desconectado");
      setOauthUrl(null);
      loadStatus();
    } catch {
      message.error("Erro ao desconectar Google Calendar");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center" }}><SyncOutlined spin /> Carregando...</div>;
  }

  // Connected state
  if (status?.connected) {
    const columns = [
      {
        title: "Data",
        dataIndex: "created_at",
        key: "created_at",
        render: (v: string) => new Date(v).toLocaleString("pt-BR"),
      },
      {
        title: "Acao",
        dataIndex: "action",
        key: "action",
        render: (v: string) => ACTION_LABELS[v] ?? v,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (v: string) => <Tag color={STATUS_COLORS[v] ?? "default"}>{v}</Tag>,
      },
      {
        title: "Paciente",
        dataIndex: "patient_name",
        key: "patient_name",
        render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
      },
    ];

    return (
      <div style={{ paddingBottom: 24 }}>
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="Google Calendar conectado"
          style={{ marginBottom: 16 }}
        />

        <Descriptions column={1} size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="Calendario">
            {status.google_calendar_id}
          </Descriptions.Item>
          <Descriptions.Item label="Conectado em">
            {status.connected_at
              ? new Date(status.connected_at).toLocaleString("pt-BR")
              : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Ultima sincronizacao">
            {status.last_sync_at
              ? new Date(status.last_sync_at).toLocaleString("pt-BR")
              : "Nunca"}
          </Descriptions.Item>
        </Descriptions>

        <Text strong style={{ display: "block", marginBottom: 8 }}>
          Historico de sincronizacao
        </Text>
        <Table
          dataSource={status.outbox_history ?? []}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: "Nenhum evento sincronizado ainda" }}
        />

        <div style={{ marginTop: 24 }}>
          <Popconfirm
            title="Desconectar Google Calendar?"
            description="A sincronizacao com o Google Calendar sera interrompida."
            onConfirm={handleDisconnect}
            okText="Sim, desconectar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DisconnectOutlined />} loading={disconnecting}>
              Desconectar
            </Button>
          </Popconfirm>
        </div>
      </div>
    );
  }

  // Disconnected state
  return (
    <div style={{ paddingBottom: 24 }}>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Conecte o Google Calendar deste profissional para sincronizar agendamentos automaticamente.
      </Paragraph>

      {!oauthUrl ? (
        <Button
          type="primary"
          icon={<LinkOutlined />}
          onClick={handleInitiate}
          loading={initiating}
        >
          Gerar link de autorizacao
        </Button>
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            message="Link gerado — aguardando autorizacao do profissional"
            description="Envie o link abaixo para o profissional autorizar a conexao com o Google Calendar."
            style={{ marginBottom: 16 }}
          />

          <Space wrap>
            <Tooltip title={!professional.email ? "Profissional sem email cadastrado" : undefined}>
              <Button
                icon={<MailOutlined />}
                onClick={() => handleSendLink("email")}
                loading={sending === "email"}
                disabled={!professional.email}
              >
                Enviar por E-mail
              </Button>
            </Tooltip>

            <Tooltip title={!professional.phone ? "Profissional sem telefone cadastrado" : undefined}>
              <Button
                icon={<WhatsAppOutlined />}
                onClick={() => handleSendLink("whatsapp")}
                loading={sending === "whatsapp"}
                disabled={!professional.phone}
              >
                Enviar por WhatsApp
              </Button>
            </Tooltip>

            <Button icon={<CopyOutlined />} onClick={handleCopyLink}>
              Copiar Link
            </Button>
          </Space>
        </>
      )}
    </div>
  );
}
