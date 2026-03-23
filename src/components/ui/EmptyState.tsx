"use client";
import { Empty, Button } from "antd";
import type { ReactNode } from "react";

type EmptyStateProps = {
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
};

export function EmptyState({ description = "Nenhum dado encontrado", actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <Empty
      image={icon || Empty.PRESENTED_IMAGE_SIMPLE}
      description={description}
    >
      {actionLabel && onAction && (
        <Button type="primary" onClick={onAction}>{actionLabel}</Button>
      )}
    </Empty>
  );
}
