"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  Input,
  Select,
  Drawer,
  Tag,
  Descriptions,
  Spin,
  Empty,
  Button,
  Space,
  Flex,
  Card,
  Avatar,
} from "antd";
import { ReloadOutlined, MessageOutlined, SearchOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatusTag } from "@/components/ui/StatusTag";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useClinicContext } from "@/hooks/useClinicContext";
import type { ColumnsType } from "antd/es/table";

type Conversation = {
  id: string;
  state: string;
  channel: string;
  current_intent: string | null;
  current_funnel_step: string | null;
  message_count: number;
  patient_name: string;
  patient_state: string;
  patient_channel: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  direction: string;
  text: string;
  llm_intent: string | null;
  entities_json: unknown;
  created_at: string;
};

const STATE_OPTIONS = [
  { value: "", label: "Todos os estados" },
  { value: "AUTO", label: "Auto" },
  { value: "WAITING", label: "Aguardando" },
  { value: "HUMAN", label: "Humano" },
  { value: "FINALIZADA", label: "Finalizada" },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConversationsPage() {
  const { activeClinicId, activeClinic } = useClinicContext();
  const { data: conversations, loading, error, refetch } = useApi<Conversation[]>(
    activeClinicId ? `/api/admin/clinics/${activeClinicId}/conversations` : "",
  );

  const [stateFilter, setStateFilter] = useState("");
  const [searchText, setSearchText] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const data = await api<Message[]>(`/api/admin/conversations/${conversationId}/messages`);
      setMessages(data);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const openDrawer = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setDrawerOpen(true);
    fetchMessages(conversation.id);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedConversation(null);
    setMessages([]);
  };

  useEffect(() => {
    if (messages.length > 0 && drawerOpen) {
      const container = document.getElementById("messages-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, drawerOpen]);

  const filtered = (conversations ?? []).filter((c) => {
    if (stateFilter && c.state !== stateFilter) return false;
    if (searchText && !c.patient_name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const columns: ColumnsType<Conversation> = [
    {
      title: "Paciente",
      dataIndex: "patient_name",
      key: "patient_name",
      ellipsis: true,
      render: (name: string) => (
        <span style={{ fontWeight: 500 }}>{name}</span>
      ),
    },
    {
      title: "Estado",
      dataIndex: "state",
      key: "state",
      width: 120,
      render: (state: string) => <StatusTag status={state} />,
    },
    {
      title: "Canal",
      dataIndex: "channel",
      key: "channel",
      width: 100,
      responsive: ["md"],
      render: (v: string) => <Tag style={{ borderRadius: 6 }}>{v}</Tag>,
    },
    {
      title: "Intent",
      dataIndex: "current_intent",
      key: "current_intent",
      width: 160,
      responsive: ["lg"],
      render: (intent: string | null) =>
        intent ? <Tag color="geekblue" style={{ borderRadius: 6 }}>{intent}</Tag> : <Tag style={{ borderRadius: 6 }}>—</Tag>,
    },
    {
      title: "Msgs",
      dataIndex: "message_count",
      key: "message_count",
      width: 70,
      align: "center",
      render: (v: number) => (
        <Tag style={{ borderRadius: 12, minWidth: 28, textAlign: "center" }}>{v}</Tag>
      ),
    },
    {
      title: "Últ. Mensagem",
      dataIndex: "last_message_at",
      key: "last_message_at",
      width: 140,
      render: (v: string | null) => (
        <span style={{ fontSize: 13, color: "#64748b" }}>{formatDateTime(v)}</span>
      ),
      sorter: (a, b) => {
        const da = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const db = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return da - db;
      },
    },
    {
      title: "Paciente",
      dataIndex: "patient_state",
      key: "patient_state",
      width: 120,
      responsive: ["xl"],
      render: (state: string) => <StatusTag status={state} />,
    },
  ];

  if (loading) return <LoadingState text="Carregando conversas..." />;
  if (error) return <ErrorState title="Erro ao carregar conversas" message={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Conversas"
        subtitle={activeClinic ? `Conversas recentes e histórico de interações` : "Conversas recentes"}
        actions={
          <Button icon={<ReloadOutlined />} onClick={refetch}>
            Atualizar
          </Button>
        }
      />

      <Card
        style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
        styles={{ body: { padding: 0 } }}
      >
        <Flex gap={12} style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }} wrap="wrap">
          <Input.Search
            placeholder="Buscar por nome do paciente..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            allowClear
            style={{ width: 280 }}
            onSearch={(v) => setSearchText(v)}
            onChange={(e) => {
              if (!e.target.value) setSearchText("");
            }}
          />
          <Select
            style={{ width: 200 }}
            value={stateFilter}
            onChange={setStateFilter}
            options={STATE_OPTIONS}
          />
        </Flex>

        <Table<Conversation>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          scroll={{ x: 600 }}
          locale={{ emptyText: <Empty description="Nenhuma conversa encontrada" /> }}
          onRow={(record) => ({
            onClick: () => openDrawer(record),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      <Drawer
        title={
          selectedConversation ? (
            <Flex align="center" gap={10}>
              <Avatar size={32} style={{ background: "#2563eb" }}>
                {selectedConversation.patient_name[0]}
              </Avatar>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedConversation.patient_name}</div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>Conversa</div>
              </div>
            </Flex>
          ) : "Conversa"
        }
        open={drawerOpen}
        onClose={closeDrawer}
        width={560}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => selectedConversation && fetchMessages(selectedConversation.id)}
              disabled={!selectedConversation}
            >
              Atualizar
            </Button>
          </Space>
        }
      >
        {selectedConversation && (
          <>
            <Descriptions
              column={2}
              size="small"
              bordered
              style={{ marginBottom: 20 }}
            >
              <Descriptions.Item label="Estado">
                <StatusTag status={selectedConversation.state} />
              </Descriptions.Item>
              <Descriptions.Item label="Canal">
                <Tag style={{ borderRadius: 6 }}>{selectedConversation.channel}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Intent">
                {selectedConversation.current_intent ? (
                  <Tag color="geekblue" style={{ borderRadius: 6 }}>{selectedConversation.current_intent}</Tag>
                ) : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Etapa Funil">
                {selectedConversation.current_funnel_step ?? "—"}
              </Descriptions.Item>
            </Descriptions>

            {messagesLoading ? (
              <Flex justify="center" style={{ padding: 40 }}>
                <Spin tip="Carregando mensagens...">
                  <div style={{ padding: 30 }} />
                </Spin>
              </Flex>
            ) : messages.length === 0 ? (
              <Empty
                image={<MessageOutlined style={{ fontSize: 48, color: "#cbd5e1" }} />}
                description="Nenhuma mensagem nesta conversa"
              />
            ) : (
              <div
                id="messages-container"
                style={{
                  maxHeight: "calc(100vh - 340px)",
                  overflowY: "auto",
                  padding: "8px 0",
                }}
              >
                {messages.map((msg) => {
                  const isInbound = msg.direction === "INBOUND";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: isInbound ? "flex-start" : "flex-end",
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "80%",
                          padding: "10px 14px",
                          borderRadius: isInbound
                            ? "4px 16px 16px 16px"
                            : "16px 4px 16px 16px",
                          background: isInbound ? "#eff6ff" : "#f1f5f9",
                          border: isInbound
                            ? "1px solid #bfdbfe"
                            : "1px solid #e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            lineHeight: "1.5",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            color: "#0f172a",
                          }}
                        >
                          {msg.text}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                            {isInbound ? "Paciente" : "Bot"}
                          </span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>
                            {formatTime(msg.created_at)}
                          </span>
                          {msg.llm_intent && (
                            <Tag
                              color="purple"
                              style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px", margin: 0, borderRadius: 4 }}
                            >
                              {msg.llm_intent}
                            </Tag>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
