"use client";

import { Table, Button, Empty, Tag, Card, Flex } from "antd";
import { ReloadOutlined, MedicineBoxOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useApi } from "@/hooks/useApi";
import { useClinicContext } from "@/hooks/useClinicContext";
import type { ColumnsType } from "antd/es/table";

type Service = {
  id: string;
  code: string;
  display_name: string;
  description: string | null;
  duration_minutes: number;
  price: number | string | null;
  active: boolean;
};

const formatPrice = (price: number | string | null): string => {
  if (price === null || price === undefined) return "—";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (num === 0) return "Gratuito";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
};

export default function ServicesPage() {
  const { activeClinicId, activeClinic } = useClinicContext();
  const {
    data: services,
    loading,
    error,
    refetch,
  } = useApi<Service[]>(
    activeClinicId ? `/api/admin/clinics/${activeClinicId}/services` : "",
  );

  const columns: ColumnsType<Service> = [
    {
      title: "Serviço",
      dataIndex: "display_name",
      key: "display_name",
      ellipsis: true,
      render: (name: string) => (
        <Flex align="center" gap={10}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#eff6ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <MedicineBoxOutlined style={{ color: "#2563eb", fontSize: 14 }} />
          </div>
          <span style={{ fontWeight: 500 }}>{name}</span>
        </Flex>
      ),
    },
    {
      title: "Código",
      dataIndex: "code",
      key: "code",
      width: 160,
      render: (v: string) => <Tag color="geekblue" style={{ borderRadius: 6 }}>{v}</Tag>,
    },
    {
      title: "Duração",
      dataIndex: "duration_minutes",
      key: "duration_minutes",
      width: 100,
      render: (v: number) => (
        <Tag style={{ borderRadius: 6 }}>{v} min</Tag>
      ),
    },
    {
      title: "Preço",
      dataIndex: "price",
      key: "price",
      width: 130,
      render: (v: number | string | null) => (
        <span style={{ fontWeight: 500, color: "#0f172a" }}>{formatPrice(v)}</span>
      ),
    },
    {
      title: "Descrição",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      responsive: ["lg"],
      render: (v: string | null) => (
        <span style={{ color: "#64748b" }}>{v ?? "—"}</span>
      ),
    },
  ];

  if (loading) return <LoadingState text="Carregando serviços..." />;
  if (error)
    return (
      <ErrorState
        title="Erro ao carregar serviços"
        message={error}
        onRetry={refetch}
      />
    );

  return (
    <>
      <PageHeader
        title="Catálogo de Serviços"
        subtitle={activeClinic ? `Serviços e tabela de preços` : "Catálogo de serviços"}
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
        <Table<Service>
          rowKey="id"
          columns={columns}
          dataSource={services ?? []}
          pagination={false}
          scroll={{ x: 600 }}
          locale={{
            emptyText: <Empty description="Nenhum serviço cadastrado" />,
          }}
        />
      </Card>
    </>
  );
}
