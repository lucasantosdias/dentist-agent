# Google Calendar Connection Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Google Calendar tab to the professionals backoffice drawer with full OAuth flow (initiate, send link, callback), disconnect functionality, connection status + sync history, and notification services (email/whatsapp with log adapters).

**Architecture:** Server-side OAuth flow — backend generates OAuth URL, professional authorizes remotely, Google redirects to backend callback that exchanges code for tokens. Notification port with composite adapter routes to email (console log) or whatsapp (console log stub). DisconnectGoogleCalendar use case cleans up all related records.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Ant Design, crypto (HMAC for state signing)

**Spec:** `docs/superpowers/specs/2026-03-31-google-calendar-connection-management-design.md`

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `src/modules/integration/application/ports/NotificationPort.ts` | Port interface for sending notifications |
| `src/modules/integration/infrastructure/LogEmailNotificationAdapter.ts` | Email adapter that logs to console |
| `src/modules/integration/infrastructure/LogWhatsAppNotificationAdapter.ts` | WhatsApp adapter that logs to console |
| `src/modules/integration/infrastructure/CompositeNotificationAdapter.ts` | Routes to email/whatsapp adapter by channel |
| `src/modules/integration/application/usecases/InitiateGoogleCalendarConnectionUseCase.ts` | Generates OAuth URL with signed state |
| `src/modules/integration/application/usecases/HandleGoogleOAuthCallbackUseCase.ts` | Exchanges code for tokens, calls ConnectGoogleCalendarUseCase |
| `src/modules/integration/application/usecases/DisconnectGoogleCalendarUseCase.ts` | Removes connection + all related records |
| `src/app/api/admin/professionals/[id]/google-calendar/initiate/route.ts` | POST — generate OAuth URL |
| `src/app/api/admin/professionals/[id]/google-calendar/send-link/route.ts` | POST — send OAuth link via notification |
| `src/app/api/admin/professionals/[id]/google-calendar/status/route.ts` | GET — connection status + sync history |
| `src/app/api/integrations/google-calendar/callback/route.ts` | GET — OAuth callback from Google |
| `src/app/(backoffice)/backoffice/professionals/_components/GoogleCalendarTab.tsx` | New tab component for the drawer |

### Modified files
| File | Change |
|---|---|
| `src/config/env.ts` | Add `GOOGLE_REDIRECT_URI` optional env var |
| `src/modules/integration/application/ports/GoogleCalendarPort.ts` | Add `exchangeCodeForTokens` method |
| `src/modules/integration/infrastructure/GoogleCalendarAdapter.ts` | Implement `exchangeCodeForTokens` |
| `src/modules/integration/application/ports/CalendarConnectionRepositoryPort.ts` | Add `deleteByProfessional` method |
| `src/modules/integration/infrastructure/PrismaCalendarConnectionRepository.ts` | Implement `deleteByProfessional` |
| `src/modules/integration/application/ports/CalendarSyncStateRepositoryPort.ts` | Add `deleteByProfessional` method |
| `src/modules/integration/infrastructure/PrismaCalendarSyncStateRepository.ts` | Implement `deleteByProfessional` |
| `src/modules/scheduling/application/ports/AvailabilityExceptionRepositoryPort.ts` | Add `cancelAllByProfessionalAndSource` method |
| `src/modules/scheduling/infrastructure/PrismaAvailabilityExceptionRepository.ts` | Implement `cancelAllByProfessionalAndSource` |
| `src/app/api/admin/professionals/[id]/google-calendar/route.ts` | Add DELETE handler |
| `src/server/container.ts` | Wire new use cases and notification adapters |
| `src/app/(backoffice)/backoffice/professionals/_components/ProfessionalDrawer.tsx` | Add Google Calendar tab |

---

## Task 1: NotificationPort + Adapters

**Files:**
- Create: `src/modules/integration/application/ports/NotificationPort.ts`
- Create: `src/modules/integration/infrastructure/LogEmailNotificationAdapter.ts`
- Create: `src/modules/integration/infrastructure/LogWhatsAppNotificationAdapter.ts`
- Create: `src/modules/integration/infrastructure/CompositeNotificationAdapter.ts`

- [ ] **Step 1: Create the NotificationPort interface**

```typescript
// src/modules/integration/application/ports/NotificationPort.ts

export type NotificationChannel = "email" | "whatsapp";

export type SendNotificationInput = {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  templateKey: string;
  data: Record<string, string>;
};

export interface NotificationPort {
  send(input: SendNotificationInput): Promise<{ sent: boolean; error?: string }>;
}
```

- [ ] **Step 2: Create the LogEmailNotificationAdapter**

```typescript
// src/modules/integration/infrastructure/LogEmailNotificationAdapter.ts

import type { NotificationPort, SendNotificationInput } from "@/modules/integration/application/ports/NotificationPort";

export class LogEmailNotificationAdapter implements NotificationPort {
  async send(input: SendNotificationInput): Promise<{ sent: boolean; error?: string }> {
    if (input.channel !== "email") {
      return { sent: false, error: "LogEmailNotificationAdapter only handles email channel" };
    }

    console.info("=== EMAIL NOTIFICATION (log adapter) ===");
    console.info(`To: ${input.recipient}`);
    console.info(`Subject: ${input.subject ?? input.templateKey}`);
    console.info(`Template: ${input.templateKey}`);
    console.info(`Data: ${JSON.stringify(input.data, null, 2)}`);
    console.info("========================================");

    return { sent: true };
  }
}
```

- [ ] **Step 3: Create the LogWhatsAppNotificationAdapter**

```typescript
// src/modules/integration/infrastructure/LogWhatsAppNotificationAdapter.ts

import type { NotificationPort, SendNotificationInput } from "@/modules/integration/application/ports/NotificationPort";

export class LogWhatsAppNotificationAdapter implements NotificationPort {
  async send(input: SendNotificationInput): Promise<{ sent: boolean; error?: string }> {
    if (input.channel !== "whatsapp") {
      return { sent: false, error: "LogWhatsAppNotificationAdapter only handles whatsapp channel" };
    }

    console.info("=== WHATSAPP NOTIFICATION (log adapter) ===");
    console.info(`To: ${input.recipient}`);
    console.info(`Template: ${input.templateKey}`);
    console.info(`Data: ${JSON.stringify(input.data, null, 2)}`);
    console.info("============================================");

    return { sent: true };
  }
}
```

- [ ] **Step 4: Create the CompositeNotificationAdapter**

```typescript
// src/modules/integration/infrastructure/CompositeNotificationAdapter.ts

import type { NotificationPort, SendNotificationInput } from "@/modules/integration/application/ports/NotificationPort";

export class CompositeNotificationAdapter implements NotificationPort {
  constructor(
    private readonly emailAdapter: NotificationPort,
    private readonly whatsappAdapter: NotificationPort,
  ) {}

  async send(input: SendNotificationInput): Promise<{ sent: boolean; error?: string }> {
    switch (input.channel) {
      case "email":
        return this.emailAdapter.send(input);
      case "whatsapp":
        return this.whatsappAdapter.send(input);
      default:
        return { sent: false, error: `Unsupported channel: ${input.channel}` };
    }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/integration/application/ports/NotificationPort.ts \
  src/modules/integration/infrastructure/LogEmailNotificationAdapter.ts \
  src/modules/integration/infrastructure/LogWhatsAppNotificationAdapter.ts \
  src/modules/integration/infrastructure/CompositeNotificationAdapter.ts
git commit -m "feat: add NotificationPort with log-based email and whatsapp adapters"
```

---

## Task 2: Add `exchangeCodeForTokens` to GoogleCalendarPort

**Files:**
- Modify: `src/modules/integration/application/ports/GoogleCalendarPort.ts:49-78`
- Modify: `src/modules/integration/infrastructure/GoogleCalendarAdapter.ts:198-229`

- [ ] **Step 1: Add method to the port interface**

In `src/modules/integration/application/ports/GoogleCalendarPort.ts`, add to the `GoogleCalendarPort` interface (before the closing `}`):

```typescript
  exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }>;
```

- [ ] **Step 2: Implement in GoogleCalendarAdapter**

In `src/modules/integration/infrastructure/GoogleCalendarAdapter.ts`, add before the `private headers(` method:

```typescript
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/integration/application/ports/GoogleCalendarPort.ts \
  src/modules/integration/infrastructure/GoogleCalendarAdapter.ts
git commit -m "feat: add exchangeCodeForTokens to GoogleCalendarPort"
```

---

## Task 3: Add `deleteByProfessional` to repository ports

**Files:**
- Modify: `src/modules/integration/application/ports/CalendarConnectionRepositoryPort.ts:12-16`
- Modify: `src/modules/integration/infrastructure/PrismaCalendarConnectionRepository.ts`
- Modify: `src/modules/integration/application/ports/CalendarSyncStateRepositoryPort.ts:3-6`
- Modify: `src/modules/integration/infrastructure/PrismaCalendarSyncStateRepository.ts`
- Modify: `src/modules/scheduling/application/ports/AvailabilityExceptionRepositoryPort.ts:13-25`
- Modify: `src/modules/scheduling/infrastructure/PrismaAvailabilityExceptionRepository.ts`

- [ ] **Step 1: Add `deleteByProfessional` to CalendarConnectionRepositoryPort**

In `src/modules/integration/application/ports/CalendarConnectionRepositoryPort.ts`, add to the interface:

```typescript
  deleteByProfessional(professionalId: string): Promise<void>;
```

- [ ] **Step 2: Implement in PrismaCalendarConnectionRepository**

In `src/modules/integration/infrastructure/PrismaCalendarConnectionRepository.ts`, add before the closing `}` of the class:

```typescript
  async deleteByProfessional(professionalId: string): Promise<void> {
    await this.prisma.professionalCalendarConnection.deleteMany({
      where: { professionalId },
    });
  }
```

- [ ] **Step 3: Add `deleteByProfessional` to CalendarSyncStateRepositoryPort**

In `src/modules/integration/application/ports/CalendarSyncStateRepositoryPort.ts`, add to the interface:

```typescript
  deleteByProfessional(professionalId: string): Promise<void>;
```

- [ ] **Step 4: Implement in PrismaCalendarSyncStateRepository**

In `src/modules/integration/infrastructure/PrismaCalendarSyncStateRepository.ts`, add before the closing `}` of the class:

```typescript
  async deleteByProfessional(professionalId: string): Promise<void> {
    await this.prisma.calendarSyncState.deleteMany({
      where: { professionalId },
    });
  }
```

- [ ] **Step 5: Add `cancelAllByProfessionalAndSource` to AvailabilityExceptionRepositoryPort**

In `src/modules/scheduling/application/ports/AvailabilityExceptionRepositoryPort.ts`, add to the interface:

```typescript
  cancelAllByProfessionalAndSource(
    professionalId: string,
    source: AvailabilityExceptionSource,
  ): Promise<number>;
```

- [ ] **Step 6: Implement in PrismaAvailabilityExceptionRepository**

In `src/modules/scheduling/infrastructure/PrismaAvailabilityExceptionRepository.ts`, add before the closing `}` of the class:

```typescript
  async cancelAllByProfessionalAndSource(
    professionalId: string,
    source: AvailabilityExceptionSource,
  ): Promise<number> {
    const result = await this.prisma.professionalAvailabilityException.updateMany({
      where: { professionalId, source, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    return result.count;
  }
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/integration/application/ports/CalendarConnectionRepositoryPort.ts \
  src/modules/integration/infrastructure/PrismaCalendarConnectionRepository.ts \
  src/modules/integration/application/ports/CalendarSyncStateRepositoryPort.ts \
  src/modules/integration/infrastructure/PrismaCalendarSyncStateRepository.ts \
  src/modules/scheduling/application/ports/AvailabilityExceptionRepositoryPort.ts \
  src/modules/scheduling/infrastructure/PrismaAvailabilityExceptionRepository.ts
git commit -m "feat: add deleteByProfessional and cancelAllByProfessionalAndSource to repositories"
```

---

## Task 4: Add `GOOGLE_REDIRECT_URI` to env config

**Files:**
- Modify: `src/config/env.ts:34-37`

- [ ] **Step 1: Add GOOGLE_REDIRECT_URI to envSchema**

In `src/config/env.ts`, add after the `GOOGLE_WEBHOOK_BASE_URL` line:

```typescript
  GOOGLE_REDIRECT_URI: z.string().optional().default(""),
```

- [ ] **Step 2: Commit**

```bash
git add src/config/env.ts
git commit -m "feat: add GOOGLE_REDIRECT_URI env var"
```

---

## Task 5: InitiateGoogleCalendarConnectionUseCase

**Files:**
- Create: `src/modules/integration/application/usecases/InitiateGoogleCalendarConnectionUseCase.ts`

- [ ] **Step 1: Create the use case**

```typescript
// src/modules/integration/application/usecases/InitiateGoogleCalendarConnectionUseCase.ts

import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { CalendarConnectionRepositoryPort } from "@/modules/integration/application/ports/CalendarConnectionRepositoryPort";
import type { Result } from "@/shared/result";
import { ok, fail } from "@/shared/result";
import { createHmac } from "crypto";

export type InitiateInput = {
  professionalId: string;
};

export type InitiateError = "PROFESSIONAL_NOT_FOUND" | "ALREADY_CONNECTED";

export class InitiateGoogleCalendarConnectionUseCase {
  constructor(
    private readonly catalogRepo: CatalogRepositoryPort,
    private readonly connectionRepo: CalendarConnectionRepositoryPort,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
  ) {}

  async execute(input: InitiateInput): Promise<Result<{ oauthUrl: string }, InitiateError>> {
    const professional = await this.catalogRepo.findProfessionalById(input.professionalId);
    if (!professional) return fail("PROFESSIONAL_NOT_FOUND");

    const existing = await this.connectionRepo.findByProfessional(input.professionalId);
    if (existing) return fail("ALREADY_CONNECTED");

    const state = this.buildSignedState(input.professionalId);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar",
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return ok({ oauthUrl });
  }

  private buildSignedState(professionalId: string): string {
    const payload = JSON.stringify({
      professionalId,
      timestamp: Date.now(),
    });
    const signature = createHmac("sha256", this.clientSecret)
      .update(payload)
      .digest("hex");
    const encoded = Buffer.from(payload).toString("base64url");
    return `${encoded}.${signature}`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/integration/application/usecases/InitiateGoogleCalendarConnectionUseCase.ts
git commit -m "feat: add InitiateGoogleCalendarConnectionUseCase"
```

---

## Task 6: HandleGoogleOAuthCallbackUseCase

**Files:**
- Create: `src/modules/integration/application/usecases/HandleGoogleOAuthCallbackUseCase.ts`

- [ ] **Step 1: Create the use case**

```typescript
// src/modules/integration/application/usecases/HandleGoogleOAuthCallbackUseCase.ts

import type { GoogleCalendarPort } from "@/modules/integration/application/ports/GoogleCalendarPort";
import type { ConnectGoogleCalendarUseCase } from "@/modules/integration/application/usecases/ConnectGoogleCalendarUseCase";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { Result } from "@/shared/result";
import { ok, fail } from "@/shared/result";
import { createHmac } from "crypto";

export type CallbackInput = {
  code: string;
  state: string;
};

export type CallbackError =
  | "INVALID_STATE"
  | "EXPIRED_STATE"
  | "PROFESSIONAL_NOT_FOUND"
  | "TOKEN_EXCHANGE_FAILED"
  | "CONNECTION_FAILED";

const STATE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export class HandleGoogleOAuthCallbackUseCase {
  constructor(
    private readonly catalogRepo: CatalogRepositoryPort,
    private readonly googleCalendar: GoogleCalendarPort,
    private readonly connectUseCase: ConnectGoogleCalendarUseCase,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
  ) {}

  async execute(input: CallbackInput): Promise<Result<{ professionalId: string }, CallbackError>> {
    // 1. Verify and decode state
    const stateResult = this.verifyState(input.state);
    if (!stateResult.ok) return stateResult;

    const { professionalId, timestamp } = stateResult.value;

    // 2. Check expiration
    if (Date.now() - timestamp > STATE_MAX_AGE_MS) {
      return fail("EXPIRED_STATE");
    }

    // 3. Verify professional exists
    const professional = await this.catalogRepo.findProfessionalById(professionalId);
    if (!professional) return fail("PROFESSIONAL_NOT_FOUND");

    // 4. Exchange code for tokens
    let tokens: { accessToken: string; refreshToken: string; expiresAt: Date };
    try {
      tokens = await this.googleCalendar.exchangeCodeForTokens(input.code, this.redirectUri);
    } catch (error) {
      console.error("Google OAuth token exchange failed:", error);
      return fail("TOKEN_EXCHANGE_FAILED");
    }

    // 5. Connect via existing use case
    const googleCalendarId = professional.email ?? "primary";
    const connectResult = await this.connectUseCase.execute({
      professionalId,
      googleCalendarId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
    });

    if (!connectResult.ok) {
      return fail("CONNECTION_FAILED");
    }

    return ok({ professionalId });
  }

  private verifyState(
    state: string,
  ): Result<{ professionalId: string; timestamp: number }, CallbackError> {
    const dotIndex = state.lastIndexOf(".");
    if (dotIndex === -1) return fail("INVALID_STATE");

    const encoded = state.substring(0, dotIndex);
    const signature = state.substring(dotIndex + 1);

    const expectedSignature = createHmac("sha256", this.clientSecret)
      .update(Buffer.from(encoded, "base64url").toString())
      .digest("hex");

    if (signature !== expectedSignature) return fail("INVALID_STATE");

    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as {
        professionalId: string;
        timestamp: number;
      };
      return ok(payload);
    } catch {
      return fail("INVALID_STATE");
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/integration/application/usecases/HandleGoogleOAuthCallbackUseCase.ts
git commit -m "feat: add HandleGoogleOAuthCallbackUseCase"
```

---

## Task 7: DisconnectGoogleCalendarUseCase

**Files:**
- Create: `src/modules/integration/application/usecases/DisconnectGoogleCalendarUseCase.ts`

- [ ] **Step 1: Create the use case**

```typescript
// src/modules/integration/application/usecases/DisconnectGoogleCalendarUseCase.ts

import type { CalendarConnectionRepositoryPort } from "@/modules/integration/application/ports/CalendarConnectionRepositoryPort";
import type { CalendarWatchChannelRepositoryPort } from "@/modules/integration/application/ports/CalendarWatchChannelRepositoryPort";
import type { CalendarSyncStateRepositoryPort } from "@/modules/integration/application/ports/CalendarSyncStateRepositoryPort";
import type { AvailabilityExceptionRepositoryPort } from "@/modules/scheduling/application/ports/AvailabilityExceptionRepositoryPort";
import type { Result } from "@/shared/result";
import { ok } from "@/shared/result";

export class DisconnectGoogleCalendarUseCase {
  constructor(
    private readonly connectionRepo: CalendarConnectionRepositoryPort,
    private readonly watchChannelRepo: CalendarWatchChannelRepositoryPort,
    private readonly syncStateRepo: CalendarSyncStateRepositoryPort,
    private readonly exceptionRepo: AvailabilityExceptionRepositoryPort,
  ) {}

  async execute(professionalId: string): Promise<Result<{ cancelled: number }, never>> {
    // 1. Delete watch channels
    await this.watchChannelRepo.deleteByProfessional(professionalId);

    // 2. Delete sync state
    await this.syncStateRepo.deleteByProfessional(professionalId);

    // 3. Cancel Google Calendar exceptions
    const cancelled = await this.exceptionRepo.cancelAllByProfessionalAndSource(
      professionalId,
      "GOOGLE_CALENDAR",
    );

    // 4. Delete calendar connection
    await this.connectionRepo.deleteByProfessional(professionalId);

    return ok({ cancelled });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/integration/application/usecases/DisconnectGoogleCalendarUseCase.ts
git commit -m "feat: add DisconnectGoogleCalendarUseCase"
```

---

## Task 8: Wire new use cases and adapters in container

**Files:**
- Modify: `src/server/container.ts`

- [ ] **Step 1: Add imports**

At the top of `src/server/container.ts`, add these imports after the existing calendar imports (line 42):

```typescript
import { InitiateGoogleCalendarConnectionUseCase } from "@/modules/integration/application/usecases/InitiateGoogleCalendarConnectionUseCase";
import { HandleGoogleOAuthCallbackUseCase } from "@/modules/integration/application/usecases/HandleGoogleOAuthCallbackUseCase";
import { DisconnectGoogleCalendarUseCase } from "@/modules/integration/application/usecases/DisconnectGoogleCalendarUseCase";
import { LogEmailNotificationAdapter } from "@/modules/integration/infrastructure/LogEmailNotificationAdapter";
import { LogWhatsAppNotificationAdapter } from "@/modules/integration/infrastructure/LogWhatsAppNotificationAdapter";
import { CompositeNotificationAdapter } from "@/modules/integration/infrastructure/CompositeNotificationAdapter";
```

- [ ] **Step 2: Add to AppContainer type**

In the `AppContainer` type, add after `processCalendarOutboxUseCase`:

```typescript
  initiateGoogleCalendarConnectionUseCase: InitiateGoogleCalendarConnectionUseCase | null;
  handleGoogleOAuthCallbackUseCase: HandleGoogleOAuthCallbackUseCase | null;
  disconnectGoogleCalendarUseCase: DisconnectGoogleCalendarUseCase | null;
  notificationAdapter: CompositeNotificationAdapter;
```

- [ ] **Step 3: Create notification adapters**

After the line `const calendarSyncStateRepository = ...` (around line 93), add:

```typescript
  // Notification adapters (always available — log-based for now)
  const emailAdapter = new LogEmailNotificationAdapter();
  const whatsappAdapter = new LogWhatsAppNotificationAdapter();
  const notificationAdapter = new CompositeNotificationAdapter(emailAdapter, whatsappAdapter);
```

- [ ] **Step 4: Create new use cases inside the `if (googleCalendar)` block**

Inside the `if (googleCalendar) { ... }` block, after `processCalendarOutboxUseCase` instantiation, add:

```typescript
    const redirectUri = env.GOOGLE_REDIRECT_URI ||
      `${env.GOOGLE_WEBHOOK_BASE_URL}/api/integrations/google-calendar/callback`;

    initiateGoogleCalendarConnectionUseCase = new InitiateGoogleCalendarConnectionUseCase(
      catalogRepository,
      calendarConnectionRepository,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    );

    handleGoogleOAuthCallbackUseCase = new HandleGoogleOAuthCallbackUseCase(
      catalogRepository,
      googleCalendar,
      connectGoogleCalendarUseCase!,
      env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    );

    disconnectGoogleCalendarUseCase = new DisconnectGoogleCalendarUseCase(
      calendarConnectionRepository,
      calendarWatchChannelRepository,
      calendarSyncStateRepository,
      availabilityExceptionRepository,
    );
```

- [ ] **Step 5: Declare the variables before the if block**

After the existing `let processCalendarOutboxUseCase` declaration, add:

```typescript
  let initiateGoogleCalendarConnectionUseCase: InitiateGoogleCalendarConnectionUseCase | null = null;
  let handleGoogleOAuthCallbackUseCase: HandleGoogleOAuthCallbackUseCase | null = null;
  let disconnectGoogleCalendarUseCase: DisconnectGoogleCalendarUseCase | null = null;
```

- [ ] **Step 6: Add to cachedContainer return**

In the `cachedContainer = { ... }` object, add after `processCalendarOutboxUseCase`:

```typescript
    initiateGoogleCalendarConnectionUseCase,
    handleGoogleOAuthCallbackUseCase,
    disconnectGoogleCalendarUseCase,
    notificationAdapter,
```

- [ ] **Step 7: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/server/container.ts
git commit -m "feat: wire calendar connection and notification use cases in container"
```

---

## Task 9: API Routes — Initiate, Send Link, Status

**Files:**
- Create: `src/app/api/admin/professionals/[id]/google-calendar/initiate/route.ts`
- Create: `src/app/api/admin/professionals/[id]/google-calendar/send-link/route.ts`
- Create: `src/app/api/admin/professionals/[id]/google-calendar/status/route.ts`

- [ ] **Step 1: Create the initiate route**

```typescript
// src/app/api/admin/professionals/[id]/google-calendar/initiate/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainer } from "@/server/container";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: professionalId } = await context.params;
  const container = getContainer();

  if (!container.initiateGoogleCalendarConnectionUseCase) {
    return NextResponse.json(
      { error: "Google Calendar integration is not configured." },
      { status: 501 },
    );
  }

  try {
    const result = await container.initiateGoogleCalendarConnectionUseCase.execute({
      professionalId,
    });

    if (!result.ok) {
      const statusMap = { PROFESSIONAL_NOT_FOUND: 404, ALREADY_CONNECTED: 409 } as const;
      return NextResponse.json(
        { error: result.error },
        { status: statusMap[result.error] ?? 400 },
      );
    }

    return NextResponse.json({ oauth_url: result.value.oauthUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the send-link route**

```typescript
// src/app/api/admin/professionals/[id]/google-calendar/send-link/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainer } from "@/server/container";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: professionalId } = await context.params;
  const container = getContainer();

  try {
    const body = await request.json() as { channel: string; oauth_url: string };
    const { channel, oauth_url } = body;

    if (!channel || !oauth_url) {
      return NextResponse.json({ error: "channel and oauth_url are required" }, { status: 400 });
    }

    if (channel !== "email" && channel !== "whatsapp") {
      return NextResponse.json({ error: "channel must be 'email' or 'whatsapp'" }, { status: 400 });
    }

    // Load professional to get contact info
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!professional) {
      return NextResponse.json({ error: "Professional not found" }, { status: 404 });
    }

    const recipient = channel === "email" ? professional.email : professional.phone;
    if (!recipient) {
      return NextResponse.json(
        { error: `Professional has no ${channel === "email" ? "email" : "phone"} registered` },
        { status: 422 },
      );
    }

    const result = await container.notificationAdapter.send({
      channel,
      recipient,
      subject: "Conecte seu Google Calendar — Dentzi AI",
      templateKey: "google-calendar-link",
      data: {
        professional_name: professional.displayName,
        oauth_url,
      },
    });

    if (!result.sent) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create the status route**

```typescript
// src/app/api/admin/professionals/[id]/google-calendar/status/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: professionalId } = await context.params;

  try {
    const connection = await prisma.professionalCalendarConnection.findFirst({
      where: { professionalId },
    });

    if (!connection) {
      return NextResponse.json({ connected: false });
    }

    // Get recent outbox history for this professional's appointments
    const outboxRecords = await prisma.calendarOutbox.findMany({
      where: {
        appointment: { professionalId },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        appointment: {
          include: {
            patient: { select: { knownName: true, fullName: true } },
          },
        },
      },
    });

    return NextResponse.json({
      connected: true,
      google_calendar_id: connection.googleCalendarId,
      connected_at: connection.createdAt.toISOString(),
      last_sync_at: connection.lastSyncAt?.toISOString() ?? null,
      outbox_history: outboxRecords.map((r) => ({
        id: r.id,
        action: r.action,
        status: r.status,
        created_at: r.createdAt.toISOString(),
        appointment_id: r.appointmentId,
        patient_name: r.appointment?.patient?.knownName ?? r.appointment?.patient?.fullName ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/professionals/[id]/google-calendar/initiate/route.ts \
  src/app/api/admin/professionals/[id]/google-calendar/send-link/route.ts \
  src/app/api/admin/professionals/[id]/google-calendar/status/route.ts
git commit -m "feat: add initiate, send-link, and status API routes for Google Calendar"
```

---

## Task 10: API Routes — DELETE (disconnect) + OAuth Callback

**Files:**
- Modify: `src/app/api/admin/professionals/[id]/google-calendar/route.ts`
- Create: `src/app/api/integrations/google-calendar/callback/route.ts`

- [ ] **Step 1: Add DELETE handler to existing google-calendar route**

In `src/app/api/admin/professionals/[id]/google-calendar/route.ts`, add after the existing `POST` function:

```typescript
// DELETE /api/admin/professionals/:id/google-calendar — Disconnect Google Calendar
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id: professionalId } = await context.params;

  const container = getContainer();

  if (!container.disconnectGoogleCalendarUseCase) {
    return NextResponse.json(
      { error: "Google Calendar integration is not configured." },
      { status: 501 },
    );
  }

  try {
    const result = await container.disconnectGoogleCalendarUseCase.execute(professionalId);

    if (!result.ok) {
      return NextResponse.json({ error: "Disconnect failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      cancelled_exceptions: result.value.cancelled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the OAuth callback route**

```typescript
// src/app/api/integrations/google-calendar/callback/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainer } from "@/server/container";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const container = getContainer();

  if (!container.handleGoogleOAuthCallbackUseCase) {
    return htmlResponse("Google Calendar integration is not configured.", 501);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return htmlResponse(`Autorizacao negada: ${error}`, 400);
  }

  if (!code || !state) {
    return htmlResponse("Parametros invalidos. Tente novamente.", 400);
  }

  try {
    const result = await container.handleGoogleOAuthCallbackUseCase.execute({ code, state });

    if (!result.ok) {
      const messages: Record<string, string> = {
        INVALID_STATE: "Link invalido ou adulterado. Solicite um novo link.",
        EXPIRED_STATE: "Link expirado. Solicite um novo link ao administrador.",
        PROFESSIONAL_NOT_FOUND: "Profissional nao encontrado.",
        TOKEN_EXCHANGE_FAILED: "Falha na autorizacao com o Google. Tente novamente.",
        CONNECTION_FAILED: "Falha ao salvar a conexao. Tente novamente.",
      };
      return htmlResponse(messages[result.error] ?? "Erro desconhecido.", 400);
    }

    return htmlResponse("Google Calendar conectado com sucesso! Voce pode fechar esta pagina.", 200, true);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return htmlResponse("Erro inesperado. Tente novamente.", 500);
  }
}

function htmlResponse(message: string, status: number, success = false): NextResponse {
  const color = success ? "#52c41a" : "#ff4d4f";
  const icon = success ? "&#10004;" : "&#10008;";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dentzi AI — Google Calendar</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}
.card{background:white;border-radius:12px;padding:48px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:400px}
.icon{font-size:48px;color:${color};margin-bottom:16px}
.msg{font-size:18px;color:#333;line-height:1.5}</style></head>
<body><div class="card"><div class="icon">${icon}</div><p class="msg">${message}</p></div></body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/professionals/[id]/google-calendar/route.ts \
  src/app/api/integrations/google-calendar/callback/route.ts
git commit -m "feat: add DELETE disconnect route and OAuth callback endpoint"
```

---

## Task 11: GoogleCalendarTab component

**Files:**
- Create: `src/app/(backoffice)/backoffice/professionals/_components/GoogleCalendarTab.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/app/(backoffice)/backoffice/professionals/_components/GoogleCalendarTab.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Space,
  Tag,
  Table,
  Typography,
  Alert,
  Popconfirm,
  App,
  Tooltip,
  Descriptions,
} from "antd";
import {
  MailOutlined,
  WhatsAppOutlined,
  CopyOutlined,
  DisconnectOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";

const { Text, Paragraph } = Typography;

type Professional = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
};

type OutboxRecord = {
  id: string;
  action: string;
  status: string;
  created_at: string;
  appointment_id: string;
  patient_name: string | null;
};

type CalendarStatus = {
  connected: boolean;
  google_calendar_id?: string;
  connected_at?: string;
  last_sync_at?: string | null;
  outbox_history?: OutboxRecord[];
};

type GoogleCalendarTabProps = {
  professional: Professional;
};

const ACTION_LABELS: Record<string, string> = {
  CREATE_EVENT: "Criar evento",
  UPDATE_EVENT: "Atualizar evento",
  CANCEL_EVENT: "Cancelar evento",
};

const STATUS_COLORS: Record<string, string> = {
  DONE: "green",
  FAILED: "red",
  PENDING: "orange",
  PROCESSING: "blue",
};

export function GoogleCalendarTab({ professional }: GoogleCalendarTabProps) {
  const { message } = App.useApp();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<CalendarStatus>(
        `/api/admin/professionals/${professional.id}/google-calendar/status`,
      );
      setStatus(data);
    } catch {
      message.error("Erro ao carregar status do Google Calendar");
    } finally {
      setLoading(false);
    }
  }, [professional.id, message]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleInitiate = async () => {
    try {
      setInitiating(true);
      const data = await api<{ oauth_url: string }>(
        `/api/admin/professionals/${professional.id}/google-calendar/initiate`,
        { method: "POST" },
      );
      setOauthUrl(data.oauth_url);
      message.success("Link de autorizacao gerado");
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      if (apiErr.data?.error === "ALREADY_CONNECTED") {
        message.warning("Este profissional ja possui Google Calendar conectado");
        loadStatus();
      } else {
        message.error("Erro ao gerar link de autorizacao");
      }
    } finally {
      setInitiating(false);
    }
  };

  const handleSendLink = async (channel: "email" | "whatsapp") => {
    if (!oauthUrl) return;
    try {
      setSending(channel);
      await api(`/api/admin/professionals/${professional.id}/google-calendar/send-link`, {
        method: "POST",
        body: { channel, oauth_url: oauthUrl },
      });
      message.success(
        channel === "email"
          ? `Link enviado para ${professional.email}`
          : `Link enviado para ${professional.phone}`,
      );
    } catch {
      message.error(`Erro ao enviar link via ${channel}`);
    } finally {
      setSending(null);
    }
  };

  const handleCopyLink = async () => {
    if (!oauthUrl) return;
    try {
      await navigator.clipboard.writeText(oauthUrl);
      message.success("Link copiado para a area de transferencia");
    } catch {
      message.error("Erro ao copiar link");
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      await api(`/api/admin/professionals/${professional.id}/google-calendar`, {
        method: "DELETE",
      });
      message.success("Google Calendar desconectado");
      setOauthUrl(null);
      loadStatus();
    } catch {
      message.error("Erro ao desconectar Google Calendar");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center" }}><SyncOutlined spin /> Carregando...</div>;
  }

  // Connected state
  if (status?.connected) {
    const columns = [
      {
        title: "Data",
        dataIndex: "created_at",
        key: "created_at",
        render: (v: string) => new Date(v).toLocaleString("pt-BR"),
      },
      {
        title: "Acao",
        dataIndex: "action",
        key: "action",
        render: (v: string) => ACTION_LABELS[v] ?? v,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (v: string) => <Tag color={STATUS_COLORS[v] ?? "default"}>{v}</Tag>,
      },
      {
        title: "Paciente",
        dataIndex: "patient_name",
        key: "patient_name",
        render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
      },
    ];

    return (
      <div style={{ paddingBottom: 24 }}>
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="Google Calendar conectado"
          style={{ marginBottom: 16 }}
        />

        <Descriptions column={1} size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="Calendario">
            {status.google_calendar_id}
          </Descriptions.Item>
          <Descriptions.Item label="Conectado em">
            {status.connected_at
              ? new Date(status.connected_at).toLocaleString("pt-BR")
              : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Ultima sincronizacao">
            {status.last_sync_at
              ? new Date(status.last_sync_at).toLocaleString("pt-BR")
              : "Nunca"}
          </Descriptions.Item>
        </Descriptions>

        <Text strong style={{ display: "block", marginBottom: 8 }}>
          Historico de sincronizacao
        </Text>
        <Table
          dataSource={status.outbox_history ?? []}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: "Nenhum evento sincronizado ainda" }}
        />

        <div style={{ marginTop: 24 }}>
          <Popconfirm
            title="Desconectar Google Calendar?"
            description="A sincronizacao com o Google Calendar sera interrompida."
            onConfirm={handleDisconnect}
            okText="Sim, desconectar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DisconnectOutlined />} loading={disconnecting}>
              Desconectar
            </Button>
          </Popconfirm>
        </div>
      </div>
    );
  }

  // Disconnected state
  return (
    <div style={{ paddingBottom: 24 }}>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Conecte o Google Calendar deste profissional para sincronizar agendamentos automaticamente.
      </Paragraph>

      {!oauthUrl ? (
        <Button
          type="primary"
          icon={<LinkOutlined />}
          onClick={handleInitiate}
          loading={initiating}
        >
          Gerar link de autorizacao
        </Button>
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            message="Link gerado — aguardando autorizacao do profissional"
            description="Envie o link abaixo para o profissional autorizar a conexao com o Google Calendar."
            style={{ marginBottom: 16 }}
          />

          <Space wrap>
            <Tooltip title={!professional.email ? "Profissional sem email cadastrado" : undefined}>
              <Button
                icon={<MailOutlined />}
                onClick={() => handleSendLink("email")}
                loading={sending === "email"}
                disabled={!professional.email}
              >
                Enviar por E-mail
              </Button>
            </Tooltip>

            <Tooltip title={!professional.phone ? "Profissional sem telefone cadastrado" : undefined}>
              <Button
                icon={<WhatsAppOutlined />}
                onClick={() => handleSendLink("whatsapp")}
                loading={sending === "whatsapp"}
                disabled={!professional.phone}
              >
                Enviar por WhatsApp
              </Button>
            </Tooltip>

            <Button icon={<CopyOutlined />} onClick={handleCopyLink}>
              Copiar Link
            </Button>
          </Space>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(backoffice)/backoffice/professionals/_components/GoogleCalendarTab.tsx
git commit -m "feat: add GoogleCalendarTab component"
```

---

## Task 12: Add Google Calendar tab to ProfessionalDrawer

**Files:**
- Modify: `src/app/(backoffice)/backoffice/professionals/_components/ProfessionalDrawer.tsx`

- [ ] **Step 1: Add import**

In `ProfessionalDrawer.tsx`, add after the existing component imports (line 24):

```typescript
import { GoogleCalendarTab } from "./GoogleCalendarTab";
```

- [ ] **Step 2: Add the tab to the Tabs items array**

In the `items` array of the `<Tabs>` component (after the services tab object, around line 420+), add a new tab entry:

```typescript
              {
                key: "google-calendar",
                label: "Google Calendar",
                children: professional ? (
                  <GoogleCalendarTab
                    professional={professional}
                  />
                ) : null,
              },
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/(backoffice)/backoffice/professionals/_components/ProfessionalDrawer.tsx
git commit -m "feat: add Google Calendar tab to ProfessionalDrawer"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Run the dev server and verify manually**

Run: `npm run dev`

Manual checks:
1. Open `/backoffice/professionals`, click a professional, see 4 tabs including "Google Calendar"
2. Google Calendar tab shows "Conecte o Google Calendar..." message
3. Click "Gerar link de autorizacao" — if Google not configured, should show 501 error toast
4. If configured: should show the 3 send options (email disabled if no email, whatsapp disabled if no phone, copy always works)

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
