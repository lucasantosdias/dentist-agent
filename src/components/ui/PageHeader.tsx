"use client";
import { Flex, Typography } from "antd";
import type { ReactNode } from "react";

const { Title, Text } = Typography;

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Flex justify="space-between" align="flex-start" style={{ marginBottom: 24 }}>
      <div>
        <Title level={3} style={{ margin: 0, fontWeight: 600, color: "#0f172a" }}>{title}</Title>
        {subtitle && <Text style={{ color: "#64748b", fontSize: 14 }}>{subtitle}</Text>}
      </div>
      {actions && <Flex gap={8} align="center">{actions}</Flex>}
    </Flex>
  );
}
