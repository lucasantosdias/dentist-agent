"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Card,
  Tabs,
  Input,
  Button,
  Tag,
  Collapse,
  Descriptions,
  Timeline,
  Space,
  Flex,
  Typography,
  Divider,
  Alert,
  Tooltip,
  App,
  Spin,
} from "antd";
import {
  SendOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  HistoryOutlined,
  SettingOutlined,
  UserOutlined,
  RobotOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, ApiError } from "@/lib/api";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

type ChatMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  text: string;
  timestamp: Date;
  latency_ms?: number;
};

type DebugEntry = {
  id: string;
  timestamp: Date;
  request: {
    channel: string;
    external_user_id: string;
    message_id: string;
    text: string;
    clinic_id?: string;
  };
  response: Record<string, unknown> | null;
  latency_ms: number;
  error?: string;
};

type InboundResponse = {
  reply_text: string;
  conversation_state: string;
  patient_state: string;
  appointment?: {
    id: string;
    status: string;
    starts_at: string;
    ends_at: string;
    professional_name: string;
    service_code: string;
  };
};

function generateUserId(): string {
  const suffix = Math.random().toString(36).substring(2, 8);
  return `test_user_${suffix}`;
}

function padMessageId(n: number): string {
  return `test_m${String(n).padStart(3, "0")}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function TestModePage() {
  const { message: messageApi } = App.useApp();

  const [externalUserId, setExternalUserId] = useState("");
  const [clinicId, setClinicId] = useState("");

  useEffect(() => {
    setExternalUserId(generateUserId());
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [messageCounter, setMessageCounter] = useState(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending || !externalUserId) return;

    const msgId = padMessageId(messageCounter);
    setMessageCounter((c) => c + 1);
    setInputText("");

    const userMsg: ChatMessage = {
      id: msgId,
      direction: "INBOUND",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    const requestPayload = {
      channel: "sim" as const,
      external_user_id: externalUserId,
      message_id: msgId,
      text,
      ...(clinicId ? { clinic_id: clinicId } : {}),
    };

    const start = performance.now();
    let debugEntry: DebugEntry;

    try {
      const response = await api<InboundResponse>("/api/channels/sim/inbound", {
        method: "POST",
        body: requestPayload,
      });

      const latency = Math.round(performance.now() - start);

      const botMsg: ChatMessage = {
        id: `${msgId}_reply`,
        direction: "OUTBOUND",
        text: response.reply_text,
        timestamp: new Date(),
        latency_ms: latency,
      };
      setMessages((prev) => [...prev, botMsg]);

      debugEntry = {
        id: msgId,
        timestamp: new Date(),
        request: requestPayload,
        response: response as unknown as Record<string, unknown>,
        latency_ms: latency,
      };
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      const errorMessage =
        err instanceof ApiError
          ? `HTTP ${err.status}: ${JSON.stringify(err.data)}`
          : err instanceof Error
            ? err.message
            : "Erro desconhecido";

      const errorMsg: ChatMessage = {
        id: `${msgId}_error`,
        direction: "OUTBOUND",
        text: `[Erro] ${errorMessage}`,
        timestamp: new Date(),
        latency_ms: latency,
      };
      setMessages((prev) => [...prev, errorMsg]);

      debugEntry = {
        id: msgId,
        timestamp: new Date(),
        request: requestPayload,
        response: null,
        latency_ms: latency,
        error: errorMessage,
      };

      messageApi.error("Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }

    setDebugEntries((prev) => [debugEntry!, ...prev]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [inputText, sending, messageCounter, externalUserId, clinicId, messageApi]);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setDebugEntries([]);
    setMessageCounter(1);
    setExternalUserId(generateUserId());
    messageApi.success("Conversa reiniciada com novo utilizador");
  }, [messageApi]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const lastEntry = debugEntries[0] ?? null;
  const lastResponse = lastEntry?.response as InboundResponse | null;

  return (
    <div>
      <PageHeader
        title="AI Simulador"
        subtitle="Teste o assistente clínico com interações em tempo real"
        actions={
          <Space>
            <Tag icon={<UserOutlined />} color="blue" style={{ borderRadius: 6 }}>
              {externalUserId}
            </Tag>
            <Tooltip title="Reiniciar conversa (novo utilizador)">
              <Button
                icon={<DeleteOutlined />}
                danger
                onClick={resetConversation}
              >
                Reiniciar
              </Button>
            </Tooltip>
          </Space>
        }
      />

      <Flex gap={16} align="stretch" style={{ height: "calc(100vh - 180px)", minHeight: 500 }}>
        {/* Chat Panel */}
        <Card
          style={{
            flex: "0 0 55%",
            display: "flex",
            flexDirection: "column",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
          }}
          styles={{ body: { flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" } }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "#fafbfc",
            }}
          >
            {messages.length === 0 && (
              <Flex justify="center" align="center" style={{ flex: 1, opacity: 0.4 }}>
                <Text type="secondary">
                  Envie uma mensagem para iniciar a conversa...
                </Text>
              </Flex>
            )}

            {messages.map((msg) => {
              const isUser = msg.direction === "INBOUND";
              const isError = msg.direction === "OUTBOUND" && msg.text.startsWith("[Erro]");

              return (
                <Flex key={msg.id} justify={isUser ? "flex-end" : "flex-start"} style={{ width: "100%" }}>
                  <div
                    style={{
                      maxWidth: "75%",
                      padding: "10px 14px",
                      borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isError ? "#fef2f2" : isUser ? "#2563eb" : "#ffffff",
                      color: isError ? "#dc2626" : isUser ? "#fff" : "#0f172a",
                      border: isError ? "1px solid #fecaca" : isUser ? "none" : "1px solid #e2e8f0",
                      wordBreak: "break-word",
                      boxShadow: isUser ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <Flex gap={4} align="center" style={{ marginBottom: 4 }}>
                      {isUser ? (
                        <UserOutlined style={{ fontSize: 11, opacity: 0.7, color: isUser ? "#fff" : undefined }} />
                      ) : (
                        <RobotOutlined style={{ fontSize: 11, opacity: 0.7, color: isError ? "#dc2626" : "#2563eb" }} />
                      )}
                      <Text style={{ fontSize: 11, opacity: 0.7, color: isUser ? "#fff" : isError ? "#dc2626" : "#64748b" }}>
                        {formatTime(msg.timestamp)}
                      </Text>
                      {msg.latency_ms != null && (
                        <Text style={{ fontSize: 10, opacity: 0.6, color: isUser ? "#fff" : isError ? "#dc2626" : "#94a3b8" }}>
                          <ClockCircleOutlined /> {msg.latency_ms}ms
                        </Text>
                      )}
                    </Flex>
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>
                      {msg.text}
                    </div>
                  </div>
                </Flex>
              );
            })}

            {sending && (
              <Flex justify="flex-start">
                <div style={{ padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "#fff", border: "1px solid #e2e8f0" }}>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} />} size="small" />
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>Digitando...</Text>
                </div>
              </Flex>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", background: "#fff" }}>
            <Flex gap={8} align="flex-end">
              <TextArea
                ref={inputRef as React.Ref<any>}
                placeholder="Pergunte ao assistente clínico... (Shift+Enter para nova linha)"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={sending}
                style={{ flex: 1, borderRadius: 8 }}
              />
              <Tooltip title="Enviar (Enter)">
                <Button
                  type="primary"
                  icon={sending ? <LoadingOutlined /> : <SendOutlined />}
                  onClick={sendMessage}
                  disabled={!inputText.trim() || sending}
                  style={{ borderRadius: 8, height: 40, width: 40 }}
                />
              </Tooltip>
            </Flex>
            <Flex justify="space-between" style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {messages.filter((m) => m.direction === "INBOUND").length} mensagens enviadas
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Próxima: {padMessageId(messageCounter)}
              </Text>
            </Flex>
          </div>
        </Card>

        {/* Debug Panel - Dark themed */}
        <Card
          style={{
            flex: "0 0 calc(45% - 16px)",
            overflow: "hidden",
            borderRadius: 12,
            background: "#0f172a",
            border: "1px solid #1e293b",
          }}
          styles={{ body: { padding: 0, height: "100%", overflow: "hidden" } }}
        >
          <Tabs
            style={{ height: "100%" }}
            tabBarStyle={{ padding: "0 16px", marginBottom: 0, borderBottom: "1px solid #1e293b" }}
            className="dark-tabs"
            items={[
              {
                key: "response",
                label: (
                  <span style={{ color: "#94a3b8" }}>
                    <CodeOutlined /> Logs de Simulação
                  </span>
                ),
                children: (
                  <div style={{ padding: 16, overflowY: "auto", height: "calc(100vh - 260px)", background: "#0f172a" }}>
                    {lastEntry ? (
                      lastEntry.error ? (
                        <Alert type="error" message="Erro na requisição" description={lastEntry.error} showIcon style={{ marginBottom: 16 }} />
                      ) : (
                        <Space orientation="vertical" style={{ width: "100%" }} size="middle">
                          {/* Chain of Thought header */}
                          <div style={{ padding: "8px 12px", background: "#1e293b", borderRadius: 8, borderLeft: "3px solid #2563eb" }}>
                            <Text style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              Cadeia de Pensamento
                            </Text>
                          </div>

                          <Descriptions
                            column={1}
                            size="small"
                            bordered
                            style={{ background: "#1e293b" }}
                            items={[
                              {
                                key: "latency",
                                label: <span style={{ color: "#94a3b8" }}>Latência</span>,
                                children: (
                                  <Tag
                                    icon={<ClockCircleOutlined />}
                                    color={lastEntry.latency_ms < 1000 ? "green" : lastEntry.latency_ms < 3000 ? "orange" : "red"}
                                    style={{ borderRadius: 6 }}
                                  >
                                    {lastEntry.latency_ms}ms
                                  </Tag>
                                ),
                              },
                              {
                                key: "msg_id",
                                label: <span style={{ color: "#94a3b8" }}>Message ID</span>,
                                children: <Text code style={{ color: "#e2e8f0" }}>{lastEntry.request.message_id}</Text>,
                              },
                            ]}
                          />

                          {/* Knowledge Retrieval */}
                          <div style={{ padding: "8px 12px", background: "#1e293b", borderRadius: 8, borderLeft: "3px solid #f59e0b" }}>
                            <Text style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              Resposta do Agente
                            </Text>
                          </div>

                          <div style={{ padding: 12, background: "#1e293b", borderRadius: 8 }}>
                            <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13, color: "#e2e8f0" }}>
                              {lastResponse?.reply_text ?? "—"}
                            </Paragraph>
                          </div>

                          {/* States */}
                          <Flex gap={8}>
                            {lastResponse?.conversation_state && (
                              <Tag color="blue" style={{ borderRadius: 6 }}>
                                Conv: {lastResponse.conversation_state}
                              </Tag>
                            )}
                            {lastResponse?.patient_state && (
                              <Tag color="purple" style={{ borderRadius: 6 }}>
                                Paciente: {lastResponse.patient_state}
                              </Tag>
                            )}
                          </Flex>

                          {/* Function Payload */}
                          <div style={{ padding: "8px 12px", background: "#1e293b", borderRadius: 8, borderLeft: "3px solid #16a34a" }}>
                            <Text style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              Function Payload
                            </Text>
                          </div>

                          <pre
                            style={{
                              background: "#1e293b",
                              border: "1px solid #334155",
                              borderRadius: 8,
                              padding: 12,
                              fontSize: 12,
                              lineHeight: 1.5,
                              overflowX: "auto",
                              maxHeight: 300,
                              margin: 0,
                              color: "#a5f3fc",
                            }}
                          >
                            {JSON.stringify(lastEntry.response, null, 2)}
                          </pre>
                        </Space>
                      )
                    ) : (
                      <Flex justify="center" align="center" style={{ height: 200, opacity: 0.4 }}>
                        <Text style={{ color: "#64748b" }}>Nenhuma resposta ainda. Envie uma mensagem.</Text>
                      </Flex>
                    )}
                  </div>
                ),
              },
              {
                key: "history",
                label: (
                  <span style={{ color: "#94a3b8" }}>
                    <HistoryOutlined /> Histórico
                  </span>
                ),
                children: (
                  <div style={{ padding: 16, overflowY: "auto", height: "calc(100vh - 260px)", background: "#0f172a" }}>
                    {debugEntries.length === 0 ? (
                      <Flex justify="center" align="center" style={{ height: 200, opacity: 0.4 }}>
                        <Text style={{ color: "#64748b" }}>Nenhuma entrada no histórico.</Text>
                      </Flex>
                    ) : (
                      <Timeline
                        items={debugEntries.map((entry) => ({
                          key: entry.id,
                          color: entry.error ? "red" : "green",
                          dot: entry.error ? undefined : <ClockCircleOutlined style={{ fontSize: 14 }} />,
                          children: (
                            <div>
                              <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
                                <Text strong style={{ fontSize: 13, color: "#e2e8f0" }}>{entry.request.message_id}</Text>
                                <Space size={4}>
                                  <Tag
                                    icon={<ClockCircleOutlined />}
                                    color={entry.error ? "red" : "green"}
                                    style={{ margin: 0, borderRadius: 6 }}
                                  >
                                    {entry.latency_ms}ms
                                  </Tag>
                                  <Text style={{ fontSize: 11, color: "#64748b" }}>{formatTime(entry.timestamp)}</Text>
                                </Space>
                              </Flex>

                              {entry.error && (
                                <Alert type="error" title={entry.error} style={{ marginBottom: 8, fontSize: 12 }} showIcon />
                              )}

                              <Collapse
                                size="small"
                                items={[
                                  {
                                    key: "req",
                                    label: <Text style={{ fontSize: 12, color: "#94a3b8" }}>Request</Text>,
                                    children: (
                                      <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.4, overflowX: "auto", color: "#a5f3fc" }}>
                                        {JSON.stringify(entry.request, null, 2)}
                                      </pre>
                                    ),
                                  },
                                  {
                                    key: "res",
                                    label: <Text style={{ fontSize: 12, color: "#94a3b8" }}>Response</Text>,
                                    children: (
                                      <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.4, overflowX: "auto", color: "#a5f3fc" }}>
                                        {entry.response ? JSON.stringify(entry.response, null, 2) : "null (erro)"}
                                      </pre>
                                    ),
                                  },
                                ]}
                              />
                            </div>
                          ),
                        }))}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: "config",
                label: (
                  <span style={{ color: "#94a3b8" }}>
                    <SettingOutlined /> Config
                  </span>
                ),
                children: (
                  <div style={{ padding: 16, overflowY: "auto", height: "calc(100vh - 260px)", background: "#0f172a" }}>
                    <Space orientation="vertical" style={{ width: "100%" }} size="middle">
                      <div>
                        <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#e2e8f0" }}>
                          External User ID
                        </Text>
                        <Input
                          prefix={<UserOutlined />}
                          value={externalUserId}
                          onChange={(e) => setExternalUserId(e.target.value)}
                          placeholder="test_user_001"
                        />
                        <Text style={{ fontSize: 11, marginTop: 4, display: "block", color: "#64748b" }}>
                          Identificador do utilizador no canal simulado.
                        </Text>
                      </div>

                      <div>
                        <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#e2e8f0" }}>
                          Clinic ID <Text style={{ fontWeight: 400, color: "#64748b" }}>(opcional)</Text>
                        </Text>
                        <Input
                          value={clinicId}
                          onChange={(e) => setClinicId(e.target.value)}
                          placeholder="UUID da clínica (usa padrão se vazio)"
                        />
                        <Text style={{ fontSize: 11, marginTop: 4, display: "block", color: "#64748b" }}>
                          Deixe vazio para usar a clínica padrão.
                        </Text>
                      </div>

                      <div>
                        <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#e2e8f0" }}>Canal</Text>
                        <Input value="sim" disabled />
                        <Text style={{ fontSize: 11, marginTop: 4, display: "block", color: "#64748b" }}>
                          O modo de teste sempre usa o canal &quot;sim&quot;.
                        </Text>
                      </div>

                      <Divider style={{ borderColor: "#1e293b" }} />

                      <Descriptions
                        title={<span style={{ color: "#e2e8f0" }}>Estado atual</span>}
                        column={1}
                        size="small"
                        bordered
                        items={[
                          { key: "user", label: <span style={{ color: "#94a3b8" }}>User ID</span>, children: <Text code style={{ color: "#e2e8f0" }}>{externalUserId}</Text> },
                          { key: "msgs", label: <span style={{ color: "#94a3b8" }}>Mensagens</span>, children: <span style={{ color: "#e2e8f0" }}>{messages.length}</span> },
                          { key: "counter", label: <span style={{ color: "#94a3b8" }}>Próximo msg_id</span>, children: <Text code style={{ color: "#e2e8f0" }}>{padMessageId(messageCounter)}</Text> },
                          { key: "debug", label: <span style={{ color: "#94a3b8" }}>Debug entries</span>, children: <span style={{ color: "#e2e8f0" }}>{debugEntries.length}</span> },
                        ]}
                      />
                    </Space>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </Flex>
    </div>
  );
}
