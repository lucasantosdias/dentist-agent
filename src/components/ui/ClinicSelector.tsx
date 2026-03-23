"use client";

import { Select, Tag, Flex, Typography } from "antd";
import { ShopOutlined } from "@ant-design/icons";
import { useClinicContext } from "@/hooks/useClinicContext";

const { Text } = Typography;

export function ClinicSelector({ collapsed }: { collapsed?: boolean }) {
  const { clinics, activeClinicId, setActiveClinicId, loading } = useClinicContext();

  if (loading || clinics.length === 0) return null;

  if (clinics.length === 1) {
    return (
      <Flex align="center" gap={8} style={{ padding: collapsed ? "0" : "0 4px" }}>
        <ShopOutlined style={{ color: "#3b82f6", fontSize: 14 }} />
        {!collapsed && (
          <Text ellipsis style={{ fontSize: 13, maxWidth: 160, color: "rgba(255,255,255,0.85)" }}>
            {clinics[0].name}
          </Text>
        )}
      </Flex>
    );
  }

  if (collapsed) {
    return (
      <Flex justify="center" style={{ padding: "4px 0" }}>
        <Tag color="blue" style={{ margin: 0, cursor: "default" }}>
          <ShopOutlined />
        </Tag>
      </Flex>
    );
  }

  return (
    <Select
      value={activeClinicId ?? undefined}
      onChange={setActiveClinicId}
      style={{ width: "100%" }}
      size="small"
      variant="filled"
      options={clinics.map((c) => ({ value: c.id, label: c.name }))}
      suffixIcon={<ShopOutlined style={{ color: "#3b82f6" }} />}
      popupMatchSelectWidth={false}
    />
  );
}
