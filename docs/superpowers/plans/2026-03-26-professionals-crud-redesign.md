# Professionals CRUD Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the professionals CRUD page with search/filters, edit/delete capabilities, a tabbed detail drawer, and a visual weekly availability schedule.

**Architecture:** Keep the existing table-based layout but upgrade it with client-side search/filtering (matching the patients page pattern), add 3 new API endpoints (PATCH professional, DELETE rule, PUT services), replace the plain rules table with a visual weekly schedule grid component, and restructure the page into focused sub-components.

**Tech Stack:** Next.js App Router, Ant Design (Table, Drawer, Tabs, TimePicker, Select, Form, Avatar, Dropdown), Prisma, TypeScript.

---

## File Structure

```
src/app/(backoffice)/backoffice/professionals/
  page.tsx                              # MODIFY — Main page: table + filters + create modal
  _components/
    ProfessionalDrawer.tsx              # CREATE — Detail drawer with 3 tabs
    ProfessionalForm.tsx                # CREATE — Shared form fields for create + edit
    WeeklyScheduleGrid.tsx              # CREATE — Visual availability grid
    ProfessionalServicesTab.tsx         # CREATE — Services checkbox tab

src/app/api/admin/professionals/[professionalId]/
  route.ts                              # CREATE — PATCH endpoint for updating a professional

src/app/api/admin/professionals/[professionalId]/availability-rules/[ruleId]/
  route.ts                              # CREATE — DELETE endpoint for removing a rule

src/app/api/admin/professionals/[professionalId]/services/
  route.ts                              # CREATE — PUT endpoint for replacing service associations
```

---

### Task 1: PATCH Professional API Endpoint

**Files:**
- Create: `src/app/api/admin/professionals/[professionalId]/route.ts`
- Reference: `src/app/api/admin/professionals/route.ts` (existing POST pattern)
- Reference: `src/modules/catalog/infrastructure/PrismaCatalogRepository.ts`

- [ ] **Step 1: Create the PATCH route handler**

```typescript
// src/app/api/admin/professionals/[professionalId]/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ professionalId: string }> };

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { professionalId } = await context.params;
    const body = await request.json();
    const {
      display_name: snakeDisplayName, displayName: camelDisplayName,
      email, phone, timezone, role, active,
      clinic_id: snakeClinicId, clinicId: camelClinicId,
      specialty_ids: snakeSpecialtyIds, specialtyIds: camelSpecialtyIds,
    } = body as {
      display_name?: string; displayName?: string;
      email?: string; phone?: string; timezone?: string;
      role?: string; active?: boolean;
      clinic_id?: string; clinicId?: string;
      specialty_ids?: string[]; specialtyIds?: string[];
    };

    const displayName = snakeDisplayName ?? camelDisplayName;
    const clinicId = snakeClinicId ?? camelClinicId;
    const specialtyIds = snakeSpecialtyIds ?? camelSpecialtyIds;

    // Check professional exists
    const existing = await prisma.professional.findUnique({
      where: { id: professionalId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Professional not found" }, { status: 404 });
    }

    // Update professional fields
    const updated = await prisma.professional.update({
      where: { id: professionalId },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(timezone !== undefined && { timezone }),
        ...(active !== undefined && { active }),
      },
      include: {
        professionalSpecialties: { include: { specialty: true } },
      },
    });

    // Update specialties if provided
    if (specialtyIds !== undefined) {
      await prisma.professionalSpecialty.deleteMany({
        where: { professionalId },
      });
      if (specialtyIds.length > 0) {
        await prisma.professionalSpecialty.createMany({
          data: specialtyIds.map((specialtyId) => ({
            professionalId,
            specialtyId,
          })),
        });
      }
    }

    // Update clinic role if provided
    if (role !== undefined && clinicId) {
      await prisma.clinicProfessional.update({
        where: {
          clinicId_professionalId: { clinicId, professionalId },
        },
        data: { role: role === "CLINIC_MANAGER" ? "CLINIC_MANAGER" : "PROFESSIONAL" },
      });
    }

    // Re-fetch to get updated specialties
    const refreshed = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: {
        professionalSpecialties: { include: { specialty: true } },
      },
    });

    return NextResponse.json({
      id: refreshed!.id,
      display_name: refreshed!.displayName,
      specialties: refreshed!.professionalSpecialties.map((ps) => ps.specialty.name),
      email: refreshed!.email,
      phone: refreshed!.phone,
      timezone: refreshed!.timezone,
      active: refreshed!.active,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify route works with curl**

```bash
# Start dev server if not running, then test:
curl -X PATCH http://localhost:3000/api/admin/professionals/<SOME_ID> \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Test Update"}' | jq .
```

Expected: 200 with updated professional JSON, or 404 if ID doesn't exist.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/professionals/\[professionalId\]/route.ts
git commit -m "feat: add PATCH endpoint for updating professionals"
```

---

### Task 2: DELETE Availability Rule API Endpoint

**Files:**
- Create: `src/app/api/admin/professionals/[professionalId]/availability-rules/[ruleId]/route.ts`
- Reference: `src/app/api/admin/professionals/[professionalId]/availability-rules/route.ts`

- [ ] **Step 1: Create the DELETE route handler**

```typescript
// src/app/api/admin/professionals/[professionalId]/availability-rules/[ruleId]/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = {
  params: Promise<{ professionalId: string; ruleId: string }>;
};

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { professionalId, ruleId } = await context.params;

    const rule = await prisma.professionalAvailabilityRule.findFirst({
      where: { id: ruleId, professionalId },
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 },
      );
    }

    await prisma.professionalAvailabilityRule.delete({
      where: { id: ruleId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/admin/professionals/[professionalId]/availability-rules/[ruleId]/route.ts"
git commit -m "feat: add DELETE endpoint for availability rules"
```

---

### Task 3: PUT Professional Services API Endpoint

**Files:**
- Create: `src/app/api/admin/professionals/[professionalId]/services/route.ts`
- Reference: `src/modules/catalog/infrastructure/PrismaCatalogRepository.ts` (`addProfessionalService` method)

- [ ] **Step 1: Create the PUT route handler**

```typescript
// src/app/api/admin/professionals/[professionalId]/services/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ professionalId: string }> };

// GET — list services for a professional
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { professionalId } = await context.params;

    const links = await prisma.professionalService.findMany({
      where: { professionalId },
      include: { service: true },
    });

    return NextResponse.json(
      links.map((l) => ({
        id: l.service.id,
        code: l.service.code,
        display_name: l.service.displayName,
        duration_minutes: l.service.durationMinutes,
      })),
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — replace all service associations
export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { professionalId } = await context.params;
    const body = await request.json();
    const serviceIds: string[] =
      body.service_ids ?? body.serviceIds ?? [];

    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    });
    if (!professional) {
      return NextResponse.json(
        { error: "Professional not found" },
        { status: 404 },
      );
    }

    // Replace all service links in a transaction
    await prisma.$transaction([
      prisma.professionalService.deleteMany({
        where: { professionalId },
      }),
      ...(serviceIds.length > 0
        ? [
            prisma.professionalService.createMany({
              data: serviceIds.map((serviceId) => ({
                professionalId,
                serviceId,
              })),
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ service_ids: serviceIds });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/admin/professionals/[professionalId]/services/route.ts"
git commit -m "feat: add GET/PUT endpoints for professional services"
```

---

### Task 4: ProfessionalForm Shared Component

**Files:**
- Create: `src/app/(backoffice)/backoffice/professionals/_components/ProfessionalForm.tsx`

- [ ] **Step 1: Create the shared form component**

This component renders the form fields used in both the create modal and the edit tab. It does NOT include `<Form>` wrapper or submit button — the parent provides those.

```tsx
// src/app/(backoffice)/backoffice/professionals/_components/ProfessionalForm.tsx
"use client";

import { Form, Input, Select, Checkbox, Divider, Typography } from "antd";

const { Text } = Typography;

type ClinicService = {
  id: string;
  code: string;
  display_name: string;
  duration_minutes: number;
};

type Specialty = {
  id: string;
  name: string;
};

type ProfessionalFormProps = {
  specialties: Specialty[];
  clinicServices: ClinicService[];
};

const ROLE_OPTIONS = [
  { value: "PROFESSIONAL", label: "Profissional" },
  { value: "CLINIC_MANAGER", label: "Gestor" },
];

const TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "Brasilia (SP, RJ, MG)" },
  { value: "America/Manaus", label: "Manaus (AM)" },
  { value: "America/Bahia", label: "Bahia (BA)" },
  { value: "America/Recife", label: "Recife (PE, PB, AL)" },
  { value: "America/Belem", label: "Belem (PA)" },
  { value: "America/Fortaleza", label: "Fortaleza (CE, MA, PI)" },
  { value: "America/Cuiaba", label: "Cuiaba (MT, MS)" },
  { value: "America/Porto_Velho", label: "Porto Velho (RO)" },
  { value: "America/Rio_Branco", label: "Rio Branco (AC)" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
];

export function ProfessionalForm({ specialties, clinicServices }: ProfessionalFormProps) {
  return (
    <>
      {/* Basic Info */}
      <Divider orientation="left" orientationMargin={0} style={{ marginTop: 0 }}>
        <Text strong style={{ fontSize: 13, color: "#64748b" }}>
          Informacoes basicas
        </Text>
      </Divider>
      <Form.Item
        name="display_name"
        label="Nome"
        rules={[{ required: true, message: "Nome e obrigatorio" }]}
      >
        <Input placeholder="Dr. Joao Silva" />
      </Form.Item>
      <Form.Item name="role" label="Papel">
        <Select options={ROLE_OPTIONS} />
      </Form.Item>

      {/* Contact */}
      <Divider orientation="left" orientationMargin={0}>
        <Text strong style={{ fontSize: 13, color: "#64748b" }}>
          Contato
        </Text>
      </Divider>
      <Form.Item name="email" label="Email">
        <Input type="email" placeholder="joao@clinica.com" />
      </Form.Item>
      <Form.Item name="phone" label="Telefone">
        <Input placeholder="+55 11 99999-9999" />
      </Form.Item>

      {/* Specialties & Services */}
      <Divider orientation="left" orientationMargin={0}>
        <Text strong style={{ fontSize: 13, color: "#64748b" }}>
          Especialidades e Servicos
        </Text>
      </Divider>
      <Form.Item name="specialty_ids" label="Especialidades">
        {specialties.length > 0 ? (
          <Select
            mode="multiple"
            placeholder="Selecione as especialidades"
            allowClear
            showSearch
            optionFilterProp="label"
            options={specialties.map((s) => ({ label: s.name, value: s.id }))}
          />
        ) : (
          <Input
            placeholder="Cadastre especialidades na aba de configuracoes"
            disabled
          />
        )}
      </Form.Item>
      {clinicServices.length > 0 && (
        <Form.Item
          name="service_ids"
          label="Servicos que este profissional realiza"
        >
          <Checkbox.Group
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
            options={clinicServices.map((s) => ({
              label: `${s.display_name} (${s.duration_minutes} min)`,
              value: s.id,
            }))}
          />
        </Form.Item>
      )}

      {/* Settings */}
      <Divider orientation="left" orientationMargin={0}>
        <Text strong style={{ fontSize: 13, color: "#64748b" }}>
          Configuracoes
        </Text>
      </Divider>
      <Form.Item
        name="timezone"
        label="Fuso Horario"
        rules={[{ required: true, message: "Fuso horario e obrigatorio" }]}
      >
        <Select
          showSearch
          placeholder="Selecione o fuso horario"
          optionFilterProp="label"
          options={TIMEZONE_OPTIONS}
        />
      </Form.Item>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(backoffice)/backoffice/professionals/_components/ProfessionalForm.tsx"
git commit -m "feat: add shared ProfessionalForm component"
```

---

### Task 5: WeeklyScheduleGrid Component

**Files:**
- Create: `src/app/(backoffice)/backoffice/professionals/_components/WeeklyScheduleGrid.tsx`

- [ ] **Step 1: Create the visual weekly schedule grid**

```tsx
// src/app/(backoffice)/backoffice/professionals/_components/WeeklyScheduleGrid.tsx
"use client";

import { Button, Empty, Spin, Tooltip } from "antd";
import { CloseOutlined } from "@ant-design/icons";

type AvailabilityRule = {
  id: string;
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number | null;
  location_id: string | null;
};

type WeeklyScheduleGridProps = {
  rules: AvailabilityRule[];
  onDeleteRule: (ruleId: string) => void;
  loading?: boolean;
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
// Show Monday (1) through Saturday (6) then Sunday (0) — Brazilian convention
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const GRID_START = 6; // 06:00
const GRID_END = 22; // 22:00
const TOTAL_HOURS = GRID_END - GRID_START;
const HOUR_MARKERS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => GRID_START + i);

function timeToFraction(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h + m / 60 - GRID_START) / TOTAL_HOURS;
}

export function WeeklyScheduleGrid({
  rules,
  onDeleteRule,
  loading,
}: WeeklyScheduleGridProps) {
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <Empty
        description="Nenhuma regra de disponibilidade cadastrada"
        style={{ padding: "32px 0" }}
      />
    );
  }

  const rulesByDay = new Map<number, AvailabilityRule[]>();
  for (const rule of rules) {
    const existing = rulesByDay.get(rule.weekday) ?? [];
    existing.push(rule);
    rulesByDay.set(rule.weekday, existing);
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 480 }}>
        {/* Time header */}
        <div
          style={{
            display: "flex",
            marginLeft: 48,
            marginBottom: 4,
            position: "relative",
            height: 20,
          }}
        >
          {HOUR_MARKERS.map((hour) => (
            <div
              key={hour}
              style={{
                position: "absolute",
                left: `${((hour - GRID_START) / TOTAL_HOURS) * 100}%`,
                transform: "translateX(-50%)",
                fontSize: 10,
                color: "#94a3b8",
                userSelect: "none",
              }}
            >
              {String(hour).padStart(2, "0")}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {DAY_ORDER.map((day) => {
          const dayRules = rulesByDay.get(day) ?? [];
          return (
            <div
              key={day}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 6,
                height: 36,
              }}
            >
              {/* Day label */}
              <div
                style={{
                  width: 48,
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: dayRules.length > 0 ? "#1e293b" : "#cbd5e1",
                }}
              >
                {WEEKDAY_LABELS[day]}
              </div>

              {/* Bar area */}
              <div
                style={{
                  flex: 1,
                  position: "relative",
                  height: 32,
                  background: "#f8fafc",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                }}
              >
                {/* Hour gridlines */}
                {HOUR_MARKERS.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      position: "absolute",
                      left: `${((hour - GRID_START) / TOTAL_HOURS) * 100}%`,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: "#f1f5f9",
                    }}
                  />
                ))}

                {/* Rule blocks */}
                {dayRules.map((rule) => {
                  const left = timeToFraction(rule.start_time) * 100;
                  const right = timeToFraction(rule.end_time) * 100;
                  const width = right - left;
                  return (
                    <Tooltip
                      key={rule.id}
                      title={`${rule.start_time} — ${rule.end_time}`}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: `${left}%`,
                          width: `${width}%`,
                          top: 3,
                          bottom: 3,
                          background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0 6px",
                          cursor: "default",
                          minWidth: 40,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "#fff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {rule.start_time}–{rule.end_time}
                        </span>
                        <Button
                          type="text"
                          size="small"
                          icon={<CloseOutlined style={{ fontSize: 10, color: "#fff" }} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRule(rule.id);
                          }}
                          style={{
                            minWidth: 16,
                            width: 16,
                            height: 16,
                            padding: 0,
                            flexShrink: 0,
                          }}
                        />
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(backoffice)/backoffice/professionals/_components/WeeklyScheduleGrid.tsx"
git commit -m "feat: add WeeklyScheduleGrid visual component"
```

---

### Task 6: ProfessionalServicesTab Component

**Files:**
- Create: `src/app/(backoffice)/backoffice/professionals/_components/ProfessionalServicesTab.tsx`

- [ ] **Step 1: Create the services tab component**

```tsx
// src/app/(backoffice)/backoffice/professionals/_components/ProfessionalServicesTab.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(backoffice)/backoffice/professionals/_components/ProfessionalServicesTab.tsx"
git commit -m "feat: add ProfessionalServicesTab component"
```

---

### Task 7: ProfessionalDrawer Component

**Files:**
- Create: `src/app/(backoffice)/backoffice/professionals/_components/ProfessionalDrawer.tsx`
- Reference: `src/app/(backoffice)/backoffice/professionals/_components/WeeklyScheduleGrid.tsx`
- Reference: `src/app/(backoffice)/backoffice/professionals/_components/ProfessionalForm.tsx`
- Reference: `src/app/(backoffice)/backoffice/professionals/_components/ProfessionalServicesTab.tsx`

- [ ] **Step 1: Create the drawer component with 3 tabs**

```tsx
// src/app/(backoffice)/backoffice/professionals/_components/ProfessionalDrawer.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Drawer,
  Tabs,
  Form,
  Button,
  Avatar,
  Tag,
  Space,
  Switch,
  App,
  Select,
  TimePicker,
  Typography,
  Popconfirm,
} from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { ProfessionalForm } from "./ProfessionalForm";
import { WeeklyScheduleGrid } from "./WeeklyScheduleGrid";
import { ProfessionalServicesTab } from "./ProfessionalServicesTab";
import { api } from "@/lib/api";
import dayjs from "dayjs";

const { Text } = Typography;

type Professional = {
  id: string;
  display_name: string;
  specialties: string[];
  email: string | null;
  phone: string | null;
  timezone: string;
  active: boolean;
  role: string;
};

type ClinicService = {
  id: string;
  code: string;
  display_name: string;
  duration_minutes: number;
};

type Specialty = {
  id: string;
  name: string;
};

type AvailabilityRule = {
  id: string;
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number | null;
  location_id: string | null;
};

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terca" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sabado" },
];

type ProfessionalDrawerProps = {
  professional: Professional | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  clinicId: string;
  clinicServices: ClinicService[];
  specialties: Specialty[];
};

export function ProfessionalDrawer({
  professional,
  open,
  onClose,
  onUpdated,
  clinicId,
  clinicServices,
  specialties,
}: ProfessionalDrawerProps) {
  const { message } = App.useApp();
  const [editForm] = Form.useForm();
  const [ruleForm] = Form.useForm();

  // State
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleFormVisible, setRuleFormVisible] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // Fetch rules
  const fetchRules = useCallback(
    async (profId: string) => {
      setRulesLoading(true);
      try {
        const data = await api<AvailabilityRule[]>(
          `/api/admin/professionals/${profId}/availability-rules`,
        );
        setRules(data);
      } catch {
        message.error("Erro ao carregar regras de disponibilidade.");
        setRules([]);
      } finally {
        setRulesLoading(false);
      }
    },
    [message],
  );

  // Reset state when professional changes
  useEffect(() => {
    if (professional && open) {
      // Find specialty IDs from names
      const specialtyIds = specialties
        .filter((s) => professional.specialties.includes(s.name))
        .map((s) => s.id);

      editForm.setFieldsValue({
        display_name: professional.display_name,
        email: professional.email ?? "",
        phone: professional.phone ?? "",
        role: professional.role,
        timezone: professional.timezone,
        specialty_ids: specialtyIds,
      });
      setActiveTab("profile");
      setRuleFormVisible(false);
      ruleForm.resetFields();
      fetchRules(professional.id);
    }
  }, [professional, open, editForm, ruleForm, fetchRules, specialties]);

  // Save profile
  const handleSaveProfile = async () => {
    if (!professional) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      await api(`/api/admin/professionals/${professional.id}`, {
        method: "PATCH",
        body: {
          display_name: values.display_name,
          email: values.email || null,
          phone: values.phone || null,
          role: values.role,
          timezone: values.timezone,
          specialty_ids: values.specialty_ids || [],
          clinic_id: clinicId,
        },
      });
      message.success("Profissional atualizado com sucesso!");
      onUpdated();
    } catch {
      message.error("Erro ao atualizar profissional.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (active: boolean) => {
    if (!professional) return;
    try {
      await api(`/api/admin/professionals/${professional.id}`, {
        method: "PATCH",
        body: { active },
      });
      message.success(active ? "Profissional ativado!" : "Profissional desativado!");
      onUpdated();
    } catch {
      message.error("Erro ao alterar status.");
    }
  };

  // Add availability rule
  const handleAddRule = async () => {
    if (!professional) return;
    try {
      const values = await ruleForm.validateFields();
      const startTime = values.start_time.format("HH:mm");
      const endTime = values.end_time.format("HH:mm");

      if (startTime >= endTime) {
        message.error("O horario de inicio deve ser anterior ao horario de fim.");
        return;
      }

      setAddingRule(true);
      await api(
        `/api/admin/professionals/${professional.id}/availability-rules`,
        {
          method: "POST",
          body: {
            weekday: values.weekday,
            start_time: startTime,
            end_time: endTime,
          },
        },
      );
      message.success("Regra adicionada com sucesso!");
      ruleForm.resetFields();
      setRuleFormVisible(false);
      fetchRules(professional.id);
    } catch {
      message.error("Erro ao adicionar regra.");
    } finally {
      setAddingRule(false);
    }
  };

  // Delete availability rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!professional) return;
    try {
      await api(
        `/api/admin/professionals/${professional.id}/availability-rules/${ruleId}`,
        { method: "DELETE" },
      );
      message.success("Regra removida!");
      fetchRules(professional.id);
    } catch {
      message.error("Erro ao remover regra.");
    }
  };

  // Avatar initials
  const initials = professional?.display_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() ?? "";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={640}
      title={null}
      styles={{
        header: { display: "none" },
        body: { padding: 0 },
      }}
      destroyOnClose
    >
      {professional && (
        <>
          {/* Header */}
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <Avatar
              size={48}
              style={{
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                fontSize: 18,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Text
                  strong
                  style={{ fontSize: 16 }}
                  ellipsis
                >
                  {professional.display_name}
                </Text>
                <Tag
                  color={professional.role === "CLINIC_MANAGER" ? "gold" : "blue"}
                >
                  {professional.role === "CLINIC_MANAGER"
                    ? "Gestor"
                    : "Profissional"}
                </Tag>
              </div>
              {professional.email && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {professional.email}
                </Text>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {professional.active ? "Ativo" : "Inativo"}
              </Text>
              <Switch
                checked={professional.active}
                onChange={handleToggleActive}
                size="small"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{ padding: "0 24px" }}
            items={[
              {
                key: "profile",
                label: "Perfil",
                children: (
                  <Form
                    form={editForm}
                    layout="vertical"
                    style={{ paddingBottom: 24 }}
                  >
                    <ProfessionalForm
                      specialties={specialties}
                      clinicServices={[]}
                    />
                    <Button
                      type="primary"
                      onClick={handleSaveProfile}
                      loading={saving}
                      style={{ marginTop: 8 }}
                    >
                      Salvar Alteracoes
                    </Button>
                  </Form>
                ),
              },
              {
                key: "availability",
                label: "Disponibilidade",
                children: (
                  <div style={{ paddingBottom: 24 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                        marginBottom: 16,
                      }}
                    >
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => fetchRules(professional.id)}
                        size="small"
                      >
                        Atualizar
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          ruleForm.resetFields();
                          setRuleFormVisible(true);
                        }}
                        size="small"
                      >
                        Adicionar Regra
                      </Button>
                    </div>

                    {/* Add rule form */}
                    {ruleFormVisible && (
                      <div
                        style={{
                          marginBottom: 20,
                          padding: 16,
                          background: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <Form form={ruleForm} layout="vertical">
                          <Form.Item
                            name="weekday"
                            label="Dia da Semana"
                            rules={[
                              {
                                required: true,
                                message: "Selecione o dia da semana",
                              },
                            ]}
                          >
                            <Select
                              placeholder="Selecione..."
                              options={WEEKDAYS}
                            />
                          </Form.Item>
                          <div style={{ display: "flex", gap: 12 }}>
                            <Form.Item
                              name="start_time"
                              label="Inicio"
                              rules={[{ required: true, message: "Obrigatorio" }]}
                              style={{ flex: 1 }}
                            >
                              <TimePicker
                                format="HH:mm"
                                minuteStep={15}
                                placeholder="08:00"
                                style={{ width: "100%" }}
                                needConfirm={false}
                              />
                            </Form.Item>
                            <Form.Item
                              name="end_time"
                              label="Fim"
                              rules={[{ required: true, message: "Obrigatorio" }]}
                              style={{ flex: 1 }}
                            >
                              <TimePicker
                                format="HH:mm"
                                minuteStep={15}
                                placeholder="17:00"
                                style={{ width: "100%" }}
                                needConfirm={false}
                              />
                            </Form.Item>
                          </div>
                          <Space>
                            <Button
                              type="primary"
                              onClick={handleAddRule}
                              loading={addingRule}
                            >
                              Salvar
                            </Button>
                            <Button
                              onClick={() => {
                                setRuleFormVisible(false);
                                ruleForm.resetFields();
                              }}
                            >
                              Cancelar
                            </Button>
                          </Space>
                        </Form>
                      </div>
                    )}

                    <WeeklyScheduleGrid
                      rules={rules}
                      onDeleteRule={handleDeleteRule}
                      loading={rulesLoading}
                    />
                  </div>
                ),
              },
              {
                key: "services",
                label: "Servicos",
                children: (
                  <div style={{ paddingBottom: 24 }}>
                    <ProfessionalServicesTab
                      professionalId={professional.id}
                      clinicServices={clinicServices}
                    />
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(backoffice)/backoffice/professionals/_components/ProfessionalDrawer.tsx"
git commit -m "feat: add ProfessionalDrawer with tabs for profile, availability, services"
```

---

### Task 8: Rewrite Main Professionals Page

**Files:**
- Modify: `src/app/(backoffice)/backoffice/professionals/page.tsx`
- Reference: `src/app/(backoffice)/backoffice/patients/page.tsx` (search/filter pattern)
- Reference: All `_components/*.tsx` created in previous tasks

- [ ] **Step 1: Rewrite page.tsx with upgraded table, filters, and new drawer**

Replace the entire contents of `src/app/(backoffice)/backoffice/professionals/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  App,
  Empty,
  Card,
  Avatar,
  Dropdown,
  Typography,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  MoreOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatusTag } from "@/components/ui/StatusTag";
import { ProfessionalForm } from "./_components/ProfessionalForm";
import { ProfessionalDrawer } from "./_components/ProfessionalDrawer";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useClinicContext } from "@/hooks/useClinicContext";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

type Professional = {
  id: string;
  display_name: string;
  specialties: string[];
  email: string | null;
  phone: string | null;
  timezone: string;
  active: boolean;
  role: string;
};

type ClinicService = {
  id: string;
  code: string;
  display_name: string;
  duration_minutes: number;
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
];

export default function ProfessionalsPage() {
  const { message } = App.useApp();
  const { activeClinicId, activeClinic } = useClinicContext();
  const {
    data: professionals,
    loading,
    error,
    refetch,
  } = useApi<Professional[]>(
    activeClinicId
      ? `/api/admin/clinics/${activeClinicId}/professionals`
      : "",
  );

  // Clinic services and specialties
  const [clinicServices, setClinicServices] = useState<ClinicService[]>([]);
  const [specialties, setSpecialties] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    if (!activeClinicId) return;
    api<ClinicService[]>(
      `/api/admin/clinics/${activeClinicId}/services`,
    )
      .then(setClinicServices)
      .catch(() => setClinicServices([]));
    api<Array<{ id: string; name: string }>>(
      `/api/admin/clinics/${activeClinicId}/specialties`,
    )
      .then(setSpecialties)
      .catch(() => setSpecialties([]));
  }, [activeClinicId]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  const filtered = useMemo(() => {
    if (!professionals) return [];
    return professionals.filter((p) => {
      const matchesSearch =
        !search ||
        p.display_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.phone ?? "").includes(search);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" && p.active) ||
        (statusFilter === "inactive" && !p.active);
      const matchesSpecialty =
        !specialtyFilter || p.specialties.includes(specialtyFilter);
      return matchesSearch && matchesStatus && matchesSpecialty;
    });
  }, [professionals, search, statusFilter, specialtyFilter]);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm();

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] =
    useState<Professional | null>(null);

  const openDrawer = (professional: Professional) => {
    setSelectedProfessional(professional);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedProfessional(null);
  };

  // Create professional
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      await api<Professional>("/api/admin/professionals", {
        method: "POST",
        body: {
          display_name: values.display_name,
          specialty_ids: values.specialty_ids || [],
          email: values.email || undefined,
          phone: values.phone || undefined,
          timezone: values.timezone,
          role: values.role || "PROFESSIONAL",
          clinic_id: activeClinicId,
          service_ids: values.service_ids || [],
        },
      });
      message.success("Profissional criado com sucesso!");
      setCreateOpen(false);
      createForm.resetFields();
      refetch();
    } catch (err: unknown) {
      const errorData =
        err && typeof err === "object" && "data" in err
          ? (err as { data: { error?: string } }).data
          : null;
      message.error(errorData?.error ?? "Erro ao criar profissional.");
    } finally {
      setCreating(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (professional: Professional) => {
    try {
      await api(`/api/admin/professionals/${professional.id}`, {
        method: "PATCH",
        body: { active: !professional.active },
      });
      message.success(
        professional.active
          ? "Profissional desativado!"
          : "Profissional ativado!",
      );
      refetch();
    } catch {
      message.error("Erro ao alterar status.");
    }
  };

  // Avatar initials helper
  const getInitials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  // Unique specialties for filter dropdown
  const specialtyOptions = useMemo(() => {
    if (!professionals) return [];
    const all = new Set(professionals.flatMap((p) => p.specialties));
    return [
      { value: "", label: "Todas" },
      ...Array.from(all).map((s) => ({ value: s, label: s })),
    ];
  }, [professionals]);

  // Table columns
  const columns: ColumnsType<Professional> = [
    {
      title: "Profissional",
      key: "name",
      ellipsis: true,
      render: (_, record) => (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
          }}
          onClick={() => openDrawer(record)}
        >
          <Avatar
            size={36}
            style={{
              background: "linear-gradient(135deg, #2563eb, #3b82f6)",
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {getInitials(record.display_name)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ display: "block", fontSize: 14 }} ellipsis>
              {record.display_name}
            </Text>
            {record.email && (
              <Text
                type="secondary"
                style={{ fontSize: 12, display: "block" }}
                ellipsis
              >
                {record.email}
              </Text>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Especialidades",
      dataIndex: "specialties",
      key: "specialties",
      width: 200,
      responsive: ["md"],
      render: (v: string[]) =>
        v.length > 0 ? (
          v.map((s) => (
            <Tag key={s} style={{ marginBottom: 2 }}>
              {s}
            </Tag>
          ))
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Papel",
      dataIndex: "role",
      key: "role",
      width: 120,
      responsive: ["lg"],
      render: (v: string) => (
        <Tag color={v === "CLINIC_MANAGER" ? "gold" : "blue"}>
          {v === "CLINIC_MANAGER" ? "Gestor" : "Profissional"}
        </Tag>
      ),
    },
    {
      title: "Telefone",
      dataIndex: "phone",
      key: "phone",
      width: 160,
      responsive: ["lg"],
      render: (v: string | null) =>
        v ? <Text>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: "Status",
      dataIndex: "active",
      key: "active",
      width: 100,
      render: (active: boolean) => (
        <StatusTag status={active ? "ACTIVE" : "INACTIVE"} />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 48,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              {
                key: "edit",
                icon: <EditOutlined />,
                label: "Editar",
                onClick: () => openDrawer(record),
              },
              {
                key: "toggle",
                icon: record.active ? (
                  <StopOutlined />
                ) : (
                  <CheckCircleOutlined />
                ),
                label: record.active ? "Desativar" : "Ativar",
                onClick: () => handleToggleActive(record),
              },
            ],
          }}
          trigger={["click"]}
        >
          <Button
            type="text"
            icon={<MoreOutlined />}
            style={{ width: 32, height: 32 }}
          />
        </Dropdown>
      ),
    },
  ];

  // Render
  if (loading) return <LoadingState text="Carregando profissionais..." />;
  if (error)
    return (
      <ErrorState
        title="Erro ao carregar profissionais"
        message={error}
        onRetry={refetch}
      />
    );

  return (
    <>
      <PageHeader
        title="Profissionais"
        subtitle={
          activeClinic
            ? `${activeClinic.name} — Gerencie os profissionais e seus horarios`
            : "Gerencie os profissionais e seus horarios"
        }
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={refetch}>
              Atualizar
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.resetFields();
                setCreateOpen(true);
              }}
            >
              Novo Profissional
            </Button>
          </Space>
        }
      />

      {/* Filters */}
      <Card
        style={{
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          marginBottom: 16,
        }}
        styles={{ body: { padding: "12px 16px" } }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ maxWidth: 320, borderRadius: 8 }}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            style={{ width: 130 }}
            placeholder="Status"
          />
          {specialtyOptions.length > 1 && (
            <Select
              value={specialtyFilter}
              onChange={setSpecialtyFilter}
              options={specialtyOptions}
              style={{ width: 180 }}
              placeholder="Especialidade"
            />
          )}
          <Text type="secondary" style={{ fontSize: 13, marginLeft: "auto" }}>
            {filtered.length}{" "}
            {filtered.length === 1 ? "profissional" : "profissionais"}
          </Text>
        </div>
      </Card>

      {/* Table */}
      <Card
        style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
        styles={{ body: { padding: 0 } }}
      >
        <Table<Professional>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
          }}
          scroll={{ x: 600 }}
          locale={{
            emptyText: (
              <Empty description="Nenhum profissional encontrado" />
            ),
          }}
          onRow={(record) => ({
            style: { cursor: "pointer" },
            onClick: () => openDrawer(record),
          })}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Novo Profissional"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="Criar"
        cancelText="Cancelar"
        destroyOnClose
        width={520}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            timezone: "America/Sao_Paulo",
            role: "PROFESSIONAL",
          }}
        >
          <ProfessionalForm
            specialties={specialties}
            clinicServices={clinicServices}
          />
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <ProfessionalDrawer
        professional={selectedProfessional}
        open={drawerOpen}
        onClose={closeDrawer}
        onUpdated={() => {
          refetch();
          // Refresh the selected professional's data in the drawer
          if (selectedProfessional) {
            api<Professional[]>(
              `/api/admin/clinics/${activeClinicId}/professionals`,
            ).then((data) => {
              const updated = data.find(
                (p) => p.id === selectedProfessional.id,
              );
              if (updated) setSelectedProfessional(updated);
            }).catch(() => {});
          }
        }}
        clinicId={activeClinicId ?? ""}
        clinicServices={clinicServices}
        specialties={specialties}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify the page renders**

```bash
# With dev server running, navigate to http://localhost:3000/backoffice/professionals
# Expected: upgraded table with search bar, filters, avatar columns, dropdown menu
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(backoffice\)/backoffice/professionals/page.tsx
git commit -m "feat: redesign professionals page with filters, avatars, drawer tabs, visual schedule"
```

---

### Task 9: Smoke Test & Polish

- [ ] **Step 1: Test the full CRUD flow in the browser**

Open `http://localhost:3000/backoffice/professionals` and verify:
1. Table loads with avatars and merged name/email column
2. Search filters by name, email, phone
3. Status and specialty dropdowns filter correctly
4. Count label updates ("N profissionais")
5. Click row → drawer opens on Profile tab with pre-filled form
6. Edit a field → click "Salvar Alteracoes" → success message, table refreshes
7. Switch to Disponibilidade tab → visual weekly grid renders existing rules
8. Click "Adicionar Regra" → fill weekday + time pickers → save → grid updates
9. Click X on a rule bar → rule is deleted → grid updates
10. Switch to Servicos tab → checkboxes load, toggle some → save → success
11. Toggle active switch in drawer header → status changes
12. "..." menu → "Desativar" → status changes in table
13. "Novo Profissional" → modal with sectioned form → create → table refreshes
14. Empty state shows when no professionals match search

- [ ] **Step 2: Fix any issues found during testing**

Address any visual glitches, misaligned elements, or broken interactions.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: polish professionals page after smoke testing"
```
