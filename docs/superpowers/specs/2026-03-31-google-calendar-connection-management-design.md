# Google Calendar Connection Management — Professional Backoffice

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Professional drawer (new tab), OAuth flow, disconnect use case, notification services

## Context

The system already has full Google Calendar integration infrastructure: OAuth token storage (`ProfessionalCalendarConnection`), webhook push notifications (`CalendarWatchChannel`), incremental sync (`CalendarSyncState`), freeBusy checks, and an outbox pattern for syncing appointments to Google Calendar. However, there is no backoffice UI to manage the connection, no OAuth redirect flow (tokens are passed manually via API), and no way to disconnect.

The goal is to let an admin initiate a Google Calendar connection from the professionals CRUD, send the OAuth authorization link to the professional via email, WhatsApp, or clipboard, and manage the connection lifecycle (view status, sync history, disconnect).

## Design

### 1. New Tab: "Google Calendar" in ProfessionalDrawer

Add a 4th tab to `ProfessionalDrawer.tsx` alongside Profile, Availability, and Services.

**State: Disconnected**
- Explanatory text: "Conecte o Google Calendar deste profissional para sincronizar agendamentos automaticamente."
- Three action buttons in a row:
  - "Enviar por E-mail" (MailOutlined) — sends OAuth link to the professional's registered email
  - "Enviar por WhatsApp" (WhatsAppOutlined) — sends OAuth link to the professional's registered phone
  - "Copiar Link" (CopyOutlined) — copies OAuth URL to clipboard
- If email or phone is missing, the respective button is disabled with tooltip explaining why
- After sending, show a success toast and badge "Link enviado — aguardando autorizacao"

**State: Pending (link sent, awaiting authorization)**
- Badge/alert: "Aguardando autorizacao do profissional"
- Show when the link was sent and via which channel
- Option to resend (same 3 buttons)

**State: Connected**
- Card showing:
  - Status badge: "Conectado" (green)
  - Google Calendar ID (e.g., `professional@gmail.com`)
  - Last sync timestamp (relative, e.g., "ha 5 minutos")
- Sync history table (last 10 outbox records for this professional):
  - Columns: Data, Acao (CREATE_EVENT / CANCEL_EVENT / UPDATE_EVENT), Status (DONE / FAILED / PENDING), Paciente
- Button "Desconectar" (danger) with confirmation modal: "Tem certeza? A sincronizacao com o Google Calendar sera interrompida."

### 2. OAuth Flow

#### 2.1 Env Variables

Add `GOOGLE_REDIRECT_URI` to `env.ts` (optional, defaults to `{GOOGLE_WEBHOOK_BASE_URL}/api/integrations/google-calendar/callback`). This is the URI registered in Google Cloud Console.

#### 2.2 Initiate Connection

**Endpoint:** `POST /api/admin/professionals/[id]/google-calendar/initiate`

**Use Case:** `InitiateGoogleCalendarConnectionUseCase`
- Input: `professionalId`
- Flow:
  1. Verify professional exists
  2. Check no active connection already exists
  3. Generate a signed `state` parameter encoding `{ professionalId, timestamp }` (use HMAC with `GOOGLE_CLIENT_SECRET` as key)
  4. Build Google OAuth URL: `https://accounts.google.com/o/oauth2/v2/auth` with params:
     - `client_id`, `redirect_uri`, `response_type=code`, `access_type=offline`, `prompt=consent`
     - `scope=https://www.googleapis.com/auth/calendar`
     - `state={signed_state}`
  5. Return `{ oauth_url }`

**Response:** `{ oauth_url: string }`

#### 2.3 Send Link

**Endpoint:** `POST /api/admin/professionals/[id]/google-calendar/send-link`

**Body:** `{ channel: "email" | "whatsapp", oauth_url: string }`

**Flow:**
1. Load professional to get email/phone
2. Call `NotificationPort.send(channel, recipient, template, { professional_name, oauth_url })`
3. Return `{ sent: true }`

#### 2.4 OAuth Callback

**Endpoint:** `GET /api/integrations/google-calendar/callback`

**Use Case:** `HandleGoogleOAuthCallbackUseCase`
- Input: `code`, `state` (from Google redirect query params)
- Flow:
  1. Verify and decode `state` parameter (check HMAC signature, extract professionalId)
  2. Reject if timestamp is older than 1 hour
  3. Exchange `code` for tokens via Google Token API (`POST https://oauth2.googleapis.com/token`)
  4. Extract `access_token`, `refresh_token`, `expires_in` from response
  5. Determine `googleCalendarId` — use the professional's email or "primary"
  6. Call existing `ConnectGoogleCalendarUseCase.execute({ professionalId, googleCalendarId, accessToken, refreshToken, tokenExpiresAt })`
  7. Redirect to a success page or show a simple HTML confirmation: "Google Calendar conectado com sucesso! Voce pode fechar esta pagina."
- Error cases: invalid state, expired state, Google token exchange failure — all render a simple error HTML page

### 3. Disconnect Flow

**Endpoint:** `DELETE /api/admin/professionals/[id]/google-calendar`

**Use Case:** `DisconnectGoogleCalendarUseCase`
- Input: `professionalId`
- Flow:
  1. Load calendar connection — if none exists, return ok (idempotent)
  2. Delete `CalendarWatchChannel` records for this professional
  3. Delete `CalendarSyncState` records for this professional
  4. Cancel all ACTIVE `ProfessionalAvailabilityException` with source `GOOGLE_CALENDAR` for this professional
  5. Delete `ProfessionalCalendarConnection` record
  6. Return `{ ok: true }`

### 4. Connection Status Endpoint

**Endpoint:** `GET /api/admin/professionals/[id]/google-calendar/status`

**Response:**
```json
{
  "connected": true,
  "google_calendar_id": "dr.silva@gmail.com",
  "connected_at": "2026-03-30T14:00:00Z",
  "last_sync_at": "2026-03-31T10:30:00Z",
  "outbox_history": [
    {
      "id": "...",
      "action": "CREATE_EVENT",
      "status": "DONE",
      "created_at": "2026-03-31T09:00:00Z",
      "appointment_id": "...",
      "patient_name": "Joao Silva"
    }
  ]
}
```

When disconnected: `{ "connected": false }`

### 5. Notification Services

#### 5.1 Port

```typescript
// src/modules/integration/application/ports/NotificationPort.ts
export interface NotificationPort {
  send(input: {
    channel: "email" | "whatsapp";
    recipient: string;       // email address or phone number
    subject?: string;        // for email
    templateKey: string;     // e.g., "google-calendar-link"
    data: Record<string, string>;
  }): Promise<{ sent: boolean; error?: string }>;
}
```

#### 5.2 Email Adapter

`src/modules/integration/infrastructure/LogEmailNotificationAdapter.ts`

- Implements `NotificationPort` for channel `"email"`
- Logs the full email content to console (`console.info`)
- Format: subject, to, body (with OAuth link)
- Interface ready for swap to SMTP/SendGrid (same port, different adapter)

Future adapter: `SmtpEmailNotificationAdapter` or `SendGridEmailNotificationAdapter` — same port, configured via env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` or `SENDGRID_API_KEY`).

#### 5.3 WhatsApp Adapter

`src/modules/integration/infrastructure/LogWhatsAppNotificationAdapter.ts`

- Implements `NotificationPort` for channel `"whatsapp"`
- Logs the message content to console (`console.info`)
- Stub implementation — ready for future WhatsApp Business API integration

#### 5.4 Composite Adapter

`src/modules/integration/infrastructure/CompositeNotificationAdapter.ts`

- Implements `NotificationPort`
- Routes to email or whatsapp adapter based on `channel` field
- Registered in `container.ts`

### 6. Container Wiring

In `src/server/container.ts`:
- Create `LogEmailNotificationAdapter` and `LogWhatsAppNotificationAdapter`
- Create `CompositeNotificationAdapter` wrapping both
- Create `InitiateGoogleCalendarConnectionUseCase` (needs env vars for OAuth URL building)
- Create `HandleGoogleOAuthCallbackUseCase` (needs GoogleCalendarPort for token exchange + ConnectGoogleCalendarUseCase)
- Create `DisconnectGoogleCalendarUseCase` (needs connection, watch channel, sync state, and exception repositories)
- All conditionally created only when `GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET` are set

### 7. File Structure (new files)

```
src/
  modules/integration/
    application/
      ports/
        NotificationPort.ts                          # Port interface
      usecases/
        InitiateGoogleCalendarConnectionUseCase.ts   # Generate OAuth URL
        HandleGoogleOAuthCallbackUseCase.ts          # Exchange code → tokens → connect
        DisconnectGoogleCalendarUseCase.ts           # Remove connection + cleanup
    infrastructure/
      LogEmailNotificationAdapter.ts                 # Console log email
      LogWhatsAppNotificationAdapter.ts              # Console log whatsapp
      CompositeNotificationAdapter.ts                # Routes by channel
  app/
    api/
      admin/professionals/[id]/google-calendar/
        initiate/route.ts                            # POST — generate OAuth URL
        send-link/route.ts                           # POST — send link via notification
        status/route.ts                              # GET — connection status + history
        route.ts                                     # DELETE added (existing file has POST)
      integrations/google-calendar/
        callback/route.ts                            # GET — OAuth callback
    (backoffice)/backoffice/professionals/
      _components/
        GoogleCalendarTab.tsx                         # New tab component
```

### 8. Security Considerations

- **State parameter:** HMAC-signed with `GOOGLE_CLIENT_SECRET` to prevent CSRF. Contains professionalId + timestamp. Validated on callback.
- **Token storage:** Tokens stored in DB (existing pattern), never exposed to frontend.
- **OAuth URL:** Generated server-side, frontend only receives the URL string.
- **Disconnect:** Idempotent, cleans up all related records.
- **Link expiration:** State parameter expires after 1 hour.

### 9. Edge Cases

- Professional has no email → "Enviar por E-mail" button disabled
- Professional has no phone → "Enviar por WhatsApp" button disabled
- Professional already connected → initiate returns error, UI shows connected state
- OAuth callback with expired/invalid state → renders error HTML page
- Google returns error during token exchange → renders error HTML page with retry suggestion
- Disconnect when not connected → returns ok (idempotent)
- Multiple send attempts → each generates a fresh OAuth URL (previous links become stale after 1h)
