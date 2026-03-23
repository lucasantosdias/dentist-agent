"use client";
import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";

type UseApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useApi<T>(path: string, params?: Record<string, string | undefined>): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = params ? JSON.stringify(params) : "";

  const fetchData = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api<T>(path, { params });
      setData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.data && typeof err.data === "object" && "error" in err.data
          ? (err.data as { error: string }).error
          : "";
        setError(detail ? `Erro ${err.status}: ${detail}` : `Erro ${err.status}`);
      } else {
        setError(err instanceof Error ? err.message : "Erro de conexão");
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paramsKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
