"use client";
import { Flex, Spin } from "antd";

type LoadingStateProps = {
  text?: string;
};

export function LoadingState({ text = "Carregando..." }: LoadingStateProps) {
  return (
    <Flex justify="center" align="center" style={{ padding: 64 }}>
      <Spin size="large" description={text}>
        <div style={{ padding: 50 }} />
      </Spin>
    </Flex>
  );
}
