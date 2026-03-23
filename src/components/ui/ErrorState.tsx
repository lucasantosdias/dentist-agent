"use client";
import { Result, Button } from "antd";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ title = "Erro", message = "Ocorreu um erro inesperado.", onRetry }: ErrorStateProps) {
  return (
    <Result
      status="error"
      title={title}
      subTitle={message}
      extra={onRetry && <Button type="primary" onClick={onRetry}>Tentar Novamente</Button>}
    />
  );
}
