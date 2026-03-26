# Professionals CRUD Redesign — UX/UI Improvements

**Date:** 2026-03-26
**Status:** Approved
**Scope:** `src/app/(backoffice)/backoffice/professionals/page.tsx` and related components

## Context

The current professionals page is a basic Ant Design table with a create modal and an availability rules drawer. It lacks search/filtering, edit/delete operations, and the availability schedule is a plain table with manual HH:mm text input. The goal is to bring it to parity with the best patterns in the codebase (patients page has search + filters) and add missing CRUD operations with a polished UX.

## Design

### 1. Professionals Table — Upgraded

**Search & Filters (matching patients page pattern):**
- Search input filtering by name, email, or phone (client-side filter on loaded data)
- Status filter dropdown: Todos / Ativo / Inativo
- Specialty filter dropdown: populated from clinic specialties

**Table columns (revised):**
- **Profissional** (primary): Avatar with initials (colored by name hash) + display name + email subtitle — replaces separate Name and Email columns
- **Especialidades**: Specialty tags (unchanged)
- **Papel**: Role badge — Profissional (blue) / Gestor (gold)
- **Telefone**: Phone number
- **Status**: StatusTag (Ativo/Inativo)
- **Acoes**: Dropdown menu (`...` button) with: "Editar" (opens drawer), "Desativar"/"Ativar" toggle

**Row click:** Opens the detail drawer (same as clicking "Editar").

**Pagination:** pageSize options 10/20/50, showSizeChanger: true.

### 2. Create Professional Modal — Improved

Keep as a Modal (not a drawer) since creation is a focused task.

**Changes:**
- Timezone field: Replace raw `<Input>` with a searchable `<Select>` pre-populated with common Brazilian timezones (America/Sao_Paulo, America/Manaus, America/Bahia, America/Recife, etc.)
- Form sections with visual separators:
  - **Informacoes basicas**: Nome (required), Papel
  - **Contato**: Email, Telefone
  - **Especialidades e Servicos**: Specialty multi-select, Service checkboxes
  - **Configuracoes**: Fuso horario
- No step wizard — just a single scrollable form with section headers (Divider + title). Simpler and faster.

### 3. Detail Drawer — New Design

Width: 640px (up from 560px).

**Header area:**
- Avatar (large, 48px) with initials + professional name (title) + role badge
- Status toggle switch (Ativo/Inativo) in the `extra` slot
- Deactivate/Activate action directly visible

**Tabs (Ant Design Tabs component):**

#### Tab 1: Perfil
- Editable form pre-populated with the professional's data
- Same fields as the create form (name, email, phone, role, specialties, timezone)
- "Salvar Alteracoes" button at the bottom, disabled until a field changes
- Uses the same form layout as create modal for consistency

#### Tab 2: Disponibilidade
- **Visual weekly schedule grid:**
  - 7 rows (Segunda to Domingo)
  - Time axis from 06:00 to 22:00
  - Existing rules rendered as colored horizontal bars on their respective day rows
  - Each bar shows start_time — end_time label
  - Hover/click on a bar: shows delete (X) button
- **Add rule form** (collapsible, below the grid):
  - Weekday: Select dropdown
  - Start time: Ant Design TimePicker (format HH:mm, minuteStep: 15)
  - End time: Ant Design TimePicker (format HH:mm, minuteStep: 15)
  - "Adicionar" button
- If no rules exist: empty state with prompt to add first rule

#### Tab 3: Servicos
- Checkbox list of all clinic services
- Pre-checked for services the professional already performs
- Save button to update the association
- Each checkbox shows service name + duration

### 4. Visual Weekly Schedule Component

A new reusable component: `WeeklyScheduleGrid`.

**Props:**
- `rules: AvailabilityRule[]` — the data to display
- `onDeleteRule: (ruleId: string) => void`
- `loading?: boolean`

**Rendering approach:**
- Pure CSS grid or flexbox (no external calendar library)
- Each day row: label (weekday name) + a horizontal bar area (proportional to time range)
- Rules rendered as absolutely positioned colored blocks within the bar area
- Time header row with hour markers (06, 08, 10, 12, 14, 16, 18, 20, 22)
- Color: Use the Ant Design primary blue (`#2563eb`) with slight opacity variations if overlapping

**Responsive:** On smaller screens, the grid can stack or simplify to a list view.

### 5. API Changes Required

**New endpoint: PATCH `/api/admin/professionals/[professionalId]`**
- Updates professional fields (display_name, email, phone, timezone, role)
- Returns updated professional

**New endpoint: DELETE `/api/admin/professionals/[professionalId]/availability-rules/[ruleId]`**
- Deletes a specific availability rule

**New endpoint: PUT `/api/admin/professionals/[professionalId]/services`**
- Replaces the professional's service associations
- Body: `{ service_ids: string[] }`

**Existing endpoints (no changes needed):**
- GET `/api/admin/clinics/[clinicId]/professionals` — list professionals
- POST `/api/admin/professionals` — create professional
- GET `/api/admin/professionals/[professionalId]/availability-rules` — list rules
- POST `/api/admin/professionals/[professionalId]/availability-rules` — add rule

### 6. Component Structure

```
src/app/(backoffice)/backoffice/professionals/
  page.tsx                          # Main page (table + filters + create modal)
  _components/
    ProfessionalDrawer.tsx          # Detail drawer with tabs
    ProfessionalForm.tsx            # Shared form fields (used in modal + drawer profile tab)
    WeeklyScheduleGrid.tsx          # Visual availability grid
    ProfessionalServicesTab.tsx     # Services tab content
```

Shared form fields extracted into `ProfessionalForm.tsx` to avoid duplication between the create modal and the edit tab.

### 7. No External Dependencies

All components use Ant Design primitives already in the project. The weekly schedule grid uses pure CSS positioning. No new npm packages needed.

## Out of Scope

- Professional photo upload
- Drag-and-drop availability editing
- Availability exceptions management (separate feature)
- Google Calendar connection UI
- Bulk operations (multi-select + bulk deactivate)
