"use client";

import { useState, useEffect } from "react";
import { Checkbox, Button, App, Empty, Spin } from "antd";
import { api } from "@/lib/api";

type ClinicService = {
  id: string;
  code: string;
  display_name: string;
  duration_minutes: number;
};

type ProfessionalServicesTabProps = {
  professionalId: string;
  clinicServices: ClinicService[];
};

export function ProfessionalServicesTab({
  professionalId,
  clinicServices,
}: ProfessionalServicesTabProps) {
  const { message } = App.useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialIds, setInitialIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api<Array<{ id: string }>>(
      `/api/admin/professionals/${professionalId}/services`,
    )
      .then((data) => {
        const ids = data.map((s) => s.id);
        setSelectedIds(ids);
        setInitialIds(ids);
      })
      .catch(() => {
        message.error("Erro ao carregar servicos do profissional.");
      })
      .finally(() => setLoading(false));
  }, [professionalId, message]);

  const hasChanges =
    JSON.stringify([...selectedIds].sort()) !==
    JSON.stringify([...initialIds].sort());

  const handleSave = async () => {
    setSaving(true);
    try {
      await api(`/api/admin/professionals/${professionalId}/services`, {
        method: "PUT",
        body: { service_ids: selectedIds },
      });
      setInitialIds(selectedIds);
      message.success("Servicos atualizados com sucesso!");
    } catch {
      message.error("Erro ao atualizar servicos.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  if (clinicServices.length === 0) {
    return (
      <Empty description="Nenhum servico cadastrado na clinica. Cadastre servicos na aba de configuracoes." />
    );
  }

  return (
    <div>
      <Checkbox.Group
        value={selectedIds}
        onChange={(values) => setSelectedIds(values as string[])}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {clinicServices.map((s) => (
          <Checkbox key={s.id} value={s.id}>
            <span style={{ fontWeight: 500 }}>{s.display_name}</span>
            <span style={{ color: "#94a3b8", marginLeft: 8 }}>
              {s.duration_minutes} min
            </span>
          </Checkbox>
        ))}
      </Checkbox.Group>

      <Button
        type="primary"
        onClick={handleSave}
        loading={saving}
        disabled={!hasChanges}
        style={{ marginTop: 24 }}
      >
        Salvar Servicos
      </Button>
    </div>
  );
}
