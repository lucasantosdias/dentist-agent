"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "@/lib/api";

export type Clinic = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  active: boolean;
};

type ClinicContextType = {
  clinics: Clinic[];
  activeClinic: Clinic | null;
  activeClinicId: string | null;
  setActiveClinicId: (id: string) => void;
  loading: boolean;
  error: string | null;
};

const ClinicContext = createContext<ClinicContextType>({
  clinics: [],
  activeClinic: null,
  activeClinicId: null,
  setActiveClinicId: () => {},
  loading: true,
  error: null,
});

const STORAGE_KEY = "dentzi_active_clinic_id";

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [activeClinicId, setActiveClinicIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api<Clinic[]>("/api/admin/clinics");
        setClinics(data);

        // Restore from localStorage or pick first
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const match = data.find((c) => c.id === stored);
        setActiveClinicIdState(match ? match.id : data[0]?.id ?? null);
      } catch {
        setError("Erro ao carregar clínicas");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const setActiveClinicId = useCallback((id: string) => {
    setActiveClinicIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const activeClinic = clinics.find((c) => c.id === activeClinicId) ?? null;

  return (
    <ClinicContext.Provider value={{ clinics, activeClinic, activeClinicId, setActiveClinicId, loading, error }}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinicContext() {
  return useContext(ClinicContext);
}
