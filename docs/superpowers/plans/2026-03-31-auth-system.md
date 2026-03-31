# Auth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add credential-based authentication to the backoffice with login, password recovery, invite flow, route protection, and role-based user model.

**Architecture:** NextAuth.js with Credentials provider, JWT session strategy, bcrypt password hashing, SHA-256 token hashing for invite/reset flows. Middleware protects `/backoffice/*` and `/api/admin/*`. Auth pages live in `(auth)` route group with minimal layout.

**Tech Stack:** NextAuth.js v4, bcrypt, Next.js middleware, Prisma, Ant Design, existing SMTP adapter

**Spec:** `docs/superpowers/specs/2026-03-31-auth-system-design.md`

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `src/lib/auth.ts` | NextAuth authOptions config (credentials provider, JWT/session callbacks) |
| `src/types/next-auth.d.ts` | Type augmentations for Session and JWT |
| `src/middleware.ts` | Route protection (redirect unauthenticated to /login) |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth API handler |
| `src/app/api/auth/forgot-password/route.ts` | POST generate reset token + send email |
| `src/app/api/auth/reset-password/route.ts` | POST validate token + set new password |
| `src/app/api/auth/accept-invite/route.ts` | POST validate invite + set password + verify email |
| `src/app/api/auth/validate-invite/route.ts` | GET validate invite token + return user name |
| `src/app/api/admin/users/invite/route.ts` | POST create user + send invite email |
| `src/app/(auth)/layout.tsx` | Minimal centered layout for auth pages |
| `src/app/(auth)/login/page.tsx` | Login form |
| `src/app/(auth)/forgot-password/page.tsx` | Forgot password form |
| `src/app/(auth)/reset-password/page.tsx` | Reset password form |
| `src/app/(auth)/accept-invite/page.tsx` | Accept invite form |
| `src/components/providers/SessionProvider.tsx` | NextAuth SessionProvider wrapper (client) |

### Modified files
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add UserRole enum, PermissionScope enum, User model, Permission model |
| `prisma/seed.ts` | Add superadmin user + permission matrix seed |
| `src/config/env.ts` | Add NEXTAUTH_SECRET, NEXTAUTH_URL |
| `src/app/(backoffice)/layout.tsx` | Wrap with SessionProvider, replace hardcoded user with session data, wire logout |
| `src/modules/integration/infrastructure/SmtpEmailNotificationAdapter.ts` | Add invite + reset password email templates |
| `.env` | Add NEXTAUTH_SECRET, NEXTAUTH_URL |
| `.env.example` | Document new env vars |

---

## Task 1: Install dependencies + env vars

**Files:**
- Modify: `package.json`
- Modify: `src/config/env.ts`
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: Install next-auth and bcrypt**

```bash
npm install next-auth@4 bcrypt
npm install -D @types/bcrypt
```

- [ ] **Step 2: Add env vars to env.ts**

In `src/config/env.ts`, add after the `GOOGLE_REDIRECT_URI` line:

```typescript
  // Auth
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
  NEXTAUTH_URL: z.string().optional().default("http://localhost:3000"),
```

- [ ] **Step 3: Add env vars to .env**

Add to `.env`:

```
# Auth
NEXTAUTH_SECRET="k8s9d7f6g5h4j3k2l1m0n9b8v7c6x5z4a3s2d1f0g9h8j7k6l5"
NEXTAUTH_URL="https://lionfish-app-w8ks9.ondigitalocean.app"
```

- [ ] **Step 4: Add env vars to .env.example**

Add to `.env.example`:

```
# Auth
NEXTAUTH_SECRET=""                             # Random 64+ char string (required)
NEXTAUTH_URL="http://localhost:3000"           # App base URL
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/config/env.ts .env.example
git commit -m "feat: install next-auth and bcrypt, add auth env vars"
```

---

## Task 2: Prisma schema — User + Permission models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add UserRole and PermissionScope enums**

In `prisma/schema.prisma`, after the `ClinicProfessionalRole` enum (line 88), add:

```prisma
enum UserRole {
  SUPERADMIN
  ADMIN
  PROFESSIONAL
  ATTENDANT
}

enum PermissionScope {
  OWN
  ORG
  ALL
}
```

- [ ] **Step 2: Add User model**

After the enums section, add:

```prisma
// ─── Auth ───────────────────────────────────────────────────

model User {
  id              String    @id @default(uuid()) @db.Uuid
  email           String    @unique
  passwordHash    String?   @map("password_hash")
  name            String
  role            UserRole
  emailVerifiedAt DateTime? @map("email_verified_at")
  active          Boolean   @default(true)
  professionalId  String?   @db.Uuid @map("professional_id")
  inviteToken     String?   @map("invite_token")
  inviteExpiresAt DateTime? @map("invite_expires_at")
  resetToken      String?   @map("reset_token")
  resetExpiresAt  DateTime? @map("reset_expires_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  professional Professional? @relation(fields: [professionalId], references: [id])

  @@index([inviteToken])
  @@index([resetToken])
  @@index([professionalId])
  @@map("user")
}
```

- [ ] **Step 3: Add Permission model**

After the User model, add:

```prisma
model Permission {
  id        String          @id @default(uuid()) @db.Uuid
  role      UserRole
  resource  String
  action    String
  scope     PermissionScope
  createdAt DateTime        @default(now()) @map("created_at")

  @@unique([role, resource, action])
  @@map("permission")
}
```

- [ ] **Step 4: Add `users` relation to Professional model**

In the `Professional` model, add to the relations:

```prisma
  users             User[]
```

- [ ] **Step 5: Push schema and generate client**

```bash
npx prisma db push
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add User and Permission models to Prisma schema"
```

---

## Task 3: NextAuth type augmentations

**Files:**
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: Create type augmentation file**

```typescript
// src/types/next-auth.d.ts

import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      professionalId: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    professionalId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    email: string;
    name: string;
    role: UserRole;
    professionalId: string | null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/next-auth.d.ts
git commit -m "feat: add NextAuth type augmentations"
```

---

## Task 4: NextAuth config + API handler

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create authOptions**

```typescript
// src/lib/auth.ts

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/server/db/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email e senha sao obrigatorios");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user) {
          throw new Error("Email ou senha incorretos");
        }

        if (!user.active) {
          throw new Error("Conta desativada");
        }

        if (!user.emailVerifiedAt) {
          throw new Error("Verifique seu email primeiro");
        }

        if (!user.passwordHash) {
          throw new Error("Finalize seu cadastro pelo link de convite");
        }

        const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!passwordValid) {
          throw new Error("Email ou senha incorretos");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          professionalId: user.professionalId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.professionalId = user.professionalId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.userId,
        email: token.email,
        name: token.name,
        role: token.role,
        professionalId: token.professionalId,
      };
      return session;
    },
  },
};
```

- [ ] **Step 2: Create NextAuth API handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/\[...nextauth\]/route.ts
git commit -m "feat: add NextAuth config with credentials provider"
```

---

## Task 5: Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

```typescript
// src/middleware.ts

import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
  "/api/auth",
  "/api/channels",
  "/api/integrations",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for session token
  const token = await getToken({ req: request });

  // No token → redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated → allow
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware protecting backoffice routes"
```

---

## Task 6: SessionProvider wrapper

**Files:**
- Create: `src/components/providers/SessionProvider.tsx`

- [ ] **Step 1: Create SessionProvider wrapper**

```typescript
// src/components/providers/SessionProvider.tsx

"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/providers/SessionProvider.tsx
git commit -m "feat: add NextAuth SessionProvider wrapper component"
```

---

## Task 7: Update backoffice layout with session data

**Files:**
- Modify: `src/app/(backoffice)/layout.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/app/(backoffice)/layout.tsx`, add after existing imports:

```typescript
import { useSession, signOut } from "next-auth/react";
import { SessionProvider } from "@/components/providers/SessionProvider";
```

- [ ] **Step 2: Wrap the return with SessionProvider**

The component currently returns `<ClinicProvider>...</ClinicProvider>`. Wrap the entire return in SessionProvider:

Replace:
```tsx
    <ClinicProvider>
```
with:
```tsx
    <SessionProvider>
    <ClinicProvider>
```

And replace the closing:
```tsx
    </ClinicProvider>
```
with:
```tsx
    </ClinicProvider>
    </SessionProvider>
```

- [ ] **Step 3: Add useSession hook**

Inside the `BackofficeLayout` function, after the existing `useState` hooks, add:

```typescript
  const { data: session } = useSession();
```

- [ ] **Step 4: Replace hardcoded user with session data**

Replace the hardcoded user display (around lines 299-311):

```tsx
              <Flex align="center" gap={8} style={{ cursor: "pointer" }}>
                <Avatar
                  size={34}
                  style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}
                  icon={<UserOutlined />}
                />
                {!collapsed && (
                  <div style={{ lineHeight: 1.2 }}>
                    <Text strong style={{ fontSize: 13, display: "block" }}>Admin</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>Gerente</Text>
                  </div>
                )}
              </Flex>
```

with:

```tsx
              <Flex align="center" gap={8} style={{ cursor: "pointer" }}>
                <Avatar
                  size={34}
                  style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}
                  icon={<UserOutlined />}
                />
                {!collapsed && session?.user && (
                  <div style={{ lineHeight: 1.2 }}>
                    <Text strong style={{ fontSize: 13, display: "block" }}>{session.user.name}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{session.user.role}</Text>
                  </div>
                )}
              </Flex>
```

- [ ] **Step 5: Wire the logout button**

Find the LogoutOutlined button in the sidebar footer and add an onClick handler. Find:

```tsx
              <LogoutOutlined />
```

in the sidebar footer area and ensure the button that contains it calls:

```typescript
onClick={() => signOut({ callbackUrl: "/login" })}
```

Look for the logout button — it's likely around lines 220-240 in the sidebar footer. Replace the button with:

```tsx
              <Button
                type="text"
                icon={<LogoutOutlined style={{ color: "rgba(255,255,255,0.45)" }} />}
                onClick={() => signOut({ callbackUrl: "/login" })}
                style={{ width: "100%", textAlign: "left", color: "rgba(255,255,255,0.45)" }}
              >
                {!collapsed && "Sair"}
              </Button>
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(backoffice\)/layout.tsx
git commit -m "feat: integrate session data and logout in backoffice layout"
```

---

## Task 8: Auth pages layout

**Files:**
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Create minimal auth layout**

```tsx
// src/app/(auth)/layout.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dentzi AI — Login",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(auth\)/layout.tsx
git commit -m "feat: add minimal centered layout for auth pages"
```

---

## Task 9: Login page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create login page**

```tsx
// src/app/(auth)/login/page.tsx

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Form, Input, Button, Typography, Alert, Divider } from "antd";
import { MailOutlined, LockOutlined } from "@ant-design/icons";

const { Title, Text, Link } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/backoffice";
  const success = searchParams.get("success");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      redirect: false,
      email: values.email,
      password: values.password,
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.push(callbackUrl);
  };

  return (
    <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Dentzi AI</Title>
        <Text type="secondary">Entre na sua conta</Text>
      </div>

      {success === "password-reset" && (
        <Alert
          type="success"
          message="Senha redefinida com sucesso. Faca login."
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {success === "invite-accepted" && (
        <Alert
          type="success"
          message="Conta criada com sucesso. Faca login."
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form layout="vertical" onFinish={handleSubmit} autoComplete="on">
        <Form.Item
          name="email"
          rules={[
            { required: true, message: "Informe seu email" },
            { type: "email", message: "Email invalido" },
          ]}
        >
          <Input
            prefix={<MailOutlined style={{ color: "#94a3b8" }} />}
            placeholder="Email"
            size="large"
            autoComplete="email"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: "Informe sua senha" }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
            placeholder="Senha"
            size="large"
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            Entrar
          </Button>
        </Form.Item>

        <div style={{ textAlign: "center" }}>
          <Link href="/forgot-password">Esqueci minha senha</Link>
        </div>
      </Form>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx
git commit -m "feat: add login page"
```

---

## Task 10: Forgot password page + API route

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`
- Create: `src/app/api/auth/forgot-password/route.ts`

- [ ] **Step 1: Create forgot password API route**

```typescript
// src/app/api/auth/forgot-password/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getContainer } from "@/server/container";
import { randomBytes, createHash } from "crypto";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { email } = await request.json() as { email: string };

    if (!email) {
      return NextResponse.json({ ok: true }); // Don't leak info
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.active) {
      return NextResponse.json({ ok: true }); // Don't leak info
    }

    // Generate token
    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(rawToken).digest("hex");

    // Save hashed token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send email
    const container = getContainer();
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    await container.notificationAdapter.send({
      channel: "email",
      recipient: user.email,
      subject: "Recupere sua senha — Dentzi AI",
      templateKey: "password-reset",
      data: { name: user.name, reset_url: resetUrl },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[forgot-password]", error);
    return NextResponse.json({ ok: true }); // Don't leak info even on error
  }
}
```

- [ ] **Step 2: Create forgot password page**

```tsx
// src/app/(auth)/forgot-password/page.tsx

"use client";

import { useState } from "react";
import { Card, Form, Input, Button, Typography, Alert } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title, Text, Link } = Typography;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (values: { email: string }) => {
    setLoading(true);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: { email: values.email },
      });
    } catch {
      // Ignore errors — don't leak info
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Esqueci minha senha</Title>
        <Text type="secondary">Informe seu email para receber o link de recuperacao</Text>
      </div>

      {sent ? (
        <>
          <Alert
            type="success"
            message="Se o email estiver cadastrado, voce recebera um link de recuperacao."
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div style={{ textAlign: "center" }}>
            <Link href="/login">Voltar ao login</Link>
          </div>
        </>
      ) : (
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "Informe seu email" },
              { type: "email", message: "Email invalido" },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Email"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              Enviar link
            </Button>
          </Form.Item>

          <div style={{ textAlign: "center" }}>
            <Link href="/login">Voltar ao login</Link>
          </div>
        </Form>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/forgot-password/route.ts \
  src/app/\(auth\)/forgot-password/page.tsx
git commit -m "feat: add forgot password flow (API + page)"
```

---

## Task 11: Reset password page + API route

**Files:**
- Create: `src/app/(auth)/reset-password/page.tsx`
- Create: `src/app/api/auth/reset-password/route.ts`

- [ ] **Step 1: Create reset password API route**

```typescript
// src/app/api/auth/reset-password/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import bcrypt from "bcrypt";
import { createHash } from "crypto";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { token, password } = await request.json() as { token: string; password: string };

    if (!token || !password) {
      return NextResponse.json({ error: "Token e senha sao obrigatorios" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Senha deve ter no minimo 8 caracteres" }, { status: 400 });
    }

    const hashedToken = createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Token invalido ou expirado" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetExpiresAt: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[reset-password]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create reset password page**

```tsx
// src/app/(auth)/reset-password/page.tsx

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Form, Input, Button, Typography, Alert } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title, Text, Link } = Typography;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <Alert type="error" message="Link invalido. Solicite um novo." showIcon />
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/forgot-password">Solicitar novo link</Link>
        </div>
      </Card>
    );
  }

  const handleSubmit = async (values: { password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      setError("As senhas nao coincidem");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: { token, password: values.password },
      });
      router.push("/login?success=password-reset");
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      setError(apiErr.data?.error ?? "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Redefinir senha</Title>
        <Text type="secondary">Escolha uma nova senha</Text>
      </div>

      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
      )}

      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="password"
          rules={[
            { required: true, message: "Informe a nova senha" },
            { min: 8, message: "Minimo 8 caracteres" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
            placeholder="Nova senha"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="confirm"
          rules={[{ required: true, message: "Confirme a senha" }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
            placeholder="Confirmar senha"
            size="large"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            Redefinir senha
          </Button>
        </Form.Item>

        <div style={{ textAlign: "center" }}>
          <Link href="/login">Voltar ao login</Link>
        </div>
      </Form>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/reset-password/route.ts \
  src/app/\(auth\)/reset-password/page.tsx
git commit -m "feat: add reset password flow (API + page)"
```

---

## Task 12: Accept invite page + API routes

**Files:**
- Create: `src/app/api/auth/validate-invite/route.ts`
- Create: `src/app/api/auth/accept-invite/route.ts`
- Create: `src/app/(auth)/accept-invite/page.tsx`

- [ ] **Step 1: Create validate invite API route**

```typescript
// src/app/api/auth/validate-invite/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { createHash } from "crypto";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ valid: false });
  }

  const hashedToken = createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      inviteToken: hashedToken,
      inviteExpiresAt: { gt: new Date() },
    },
    select: { name: true, email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, name: user.name, email: user.email, role: user.role });
}
```

- [ ] **Step 2: Create accept invite API route**

```typescript
// src/app/api/auth/accept-invite/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import bcrypt from "bcrypt";
import { createHash } from "crypto";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { token, password } = await request.json() as { token: string; password: string };

    if (!token || !password) {
      return NextResponse.json({ error: "Token e senha sao obrigatorios" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Senha deve ter no minimo 8 caracteres" }, { status: 400 });
    }

    const hashedToken = createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        inviteToken: hashedToken,
        inviteExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Convite invalido ou expirado" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerifiedAt: new Date(),
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[accept-invite]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create accept invite page**

```tsx
// src/app/(auth)/accept-invite/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Form, Input, Button, Typography, Alert, Spin, Tag } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title, Text, Link } = Typography;

type InviteInfo = { valid: boolean; name?: string; email?: string; role?: string };

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInviteInfo({ valid: false });
      setLoading(false);
      return;
    }

    api<InviteInfo>(`/api/auth/validate-invite?token=${token}`)
      .then(setInviteInfo)
      .catch(() => setInviteInfo({ valid: false }))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (values: { password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      setError("As senhas nao coincidem");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api("/api/auth/accept-invite", {
        method: "POST",
        body: { token, password: values.password },
      });
      router.push("/login?success=invite-accepted");
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      setError(apiErr.data?.error ?? "Erro ao criar conta");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card style={{ width: 400, textAlign: "center", padding: 48 }}>
        <Spin size="large" />
      </Card>
    );
  }

  if (!inviteInfo?.valid) {
    return (
      <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <Alert
          type="error"
          message="Convite invalido ou expirado"
          description="Solicite um novo convite ao administrador."
          showIcon
        />
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/login">Ir para o login</Link>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Bem-vindo a Dentzi AI</Title>
        <Text type="secondary">Crie sua senha para acessar a plataforma</Text>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <UserOutlined style={{ color: "#64748b" }} />
          <Text strong>{inviteInfo.name}</Text>
        </div>
        <Text type="secondary" style={{ fontSize: 13 }}>{inviteInfo.email}</Text>
        <Tag color="blue" style={{ marginLeft: 8 }}>{inviteInfo.role}</Tag>
      </div>

      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
      )}

      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="password"
          rules={[
            { required: true, message: "Informe a senha" },
            { min: 8, message: "Minimo 8 caracteres" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
            placeholder="Senha"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="confirm"
          rules={[{ required: true, message: "Confirme a senha" }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
            placeholder="Confirmar senha"
            size="large"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block size="large">
            Criar conta
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/validate-invite/route.ts \
  src/app/api/auth/accept-invite/route.ts \
  src/app/\(auth\)/accept-invite/page.tsx
git commit -m "feat: add accept invite flow (validate + accept API + page)"
```

---

## Task 13: Invite user API route

**Files:**
- Create: `src/app/api/admin/users/invite/route.ts`

- [ ] **Step 1: Create invite user API route**

```typescript
// src/app/api/admin/users/invite/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/server/db/prisma";
import { getContainer } from "@/server/container";
import { randomBytes, createHash } from "crypto";
import type { UserRole } from "@prisma/client";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const currentRole = session.user.role;

  if (currentRole !== "SUPERADMIN" && currentRole !== "ADMIN") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      email: string;
      name: string;
      role: UserRole;
      professionalId?: string;
    };

    const { email, name, role, professionalId } = body;

    if (!email || !name || !role) {
      return NextResponse.json({ error: "email, name e role sao obrigatorios" }, { status: 400 });
    }

    // ADMIN can only create PROFESSIONAL or ATTENDANT
    if (currentRole === "ADMIN" && (role === "SUPERADMIN" || role === "ADMIN")) {
      return NextResponse.json({ error: "Admin so pode criar profissionais e atendentes" }, { status: 403 });
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json({ error: "Email ja cadastrado" }, { status: 409 });
    }

    // If PROFESSIONAL, professionalId is required
    if (role === "PROFESSIONAL") {
      if (!professionalId) {
        return NextResponse.json({ error: "professionalId e obrigatorio para profissionais" }, { status: 400 });
      }
      const professional = await prisma.professional.findUnique({ where: { id: professionalId } });
      if (!professional) {
        return NextResponse.json({ error: "Profissional nao encontrado" }, { status: 404 });
      }
    }

    // Generate invite token
    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(rawToken).digest("hex");

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name,
        role,
        professionalId: role === "PROFESSIONAL" ? professionalId : null,
        inviteToken: hashedToken,
        inviteExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
      },
    });

    // Send invite email
    const container = getContainer();
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/accept-invite?token=${rawToken}`;

    const roleLabels: Record<string, string> = {
      SUPERADMIN: "Super Administrador",
      ADMIN: "Administrador",
      PROFESSIONAL: "Profissional",
      ATTENDANT: "Atendente",
    };

    await container.notificationAdapter.send({
      channel: "email",
      recipient: user.email,
      subject: "Voce foi convidado para a Dentzi AI",
      templateKey: "user-invite",
      data: {
        name: user.name,
        role: roleLabels[user.role] ?? user.role,
        invite_url: inviteUrl,
      },
    });

    return NextResponse.json({ id: user.id, email: user.email, role: user.role }, { status: 201 });
  } catch (error) {
    console.error("[invite-user]", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/users/invite/route.ts
git commit -m "feat: add invite user API route"
```

---

## Task 14: Email templates for invite + reset

**Files:**
- Modify: `src/modules/integration/infrastructure/SmtpEmailNotificationAdapter.ts`

- [ ] **Step 1: Add invite and reset password templates**

In `SmtpEmailNotificationAdapter.ts`, in the `renderTemplate` method, add two new template cases before the fallback. After the `google-calendar-link` template block and before the fallback comment, add:

```typescript
    if (templateKey === "user-invite") {
      const roleLabel = data.role ?? "Membro";
      return `
        <div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a1a;margin-bottom:8px">Dentzi AI</h2>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Ola, <strong>${data.name ?? ""}</strong>!
          </p>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Voce foi convidado para a plataforma Dentzi AI como <strong>${roleLabel}</strong>.
          </p>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Clique no botao abaixo para criar sua senha e acessar a plataforma.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${data.invite_url ?? "#"}"
               style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;display:inline-block">
              Criar minha senha
            </a>
          </div>
          <p style="color:#999;font-size:13px">
            Este link expira em 72 horas.
          </p>
        </div>
      `;
    }

    if (templateKey === "password-reset") {
      return `
        <div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a1a;margin-bottom:8px">Dentzi AI</h2>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Ola, <strong>${data.name ?? ""}</strong>!
          </p>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Recebemos uma solicitacao para redefinir sua senha.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${data.reset_url ?? "#"}"
               style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;display:inline-block">
              Redefinir senha
            </a>
          </div>
          <p style="color:#999;font-size:13px">
            Este link expira em 1 hora. Se voce nao solicitou, ignore este email.
          </p>
        </div>
      `;
    }
```

Also add the same templates to `LogEmailNotificationAdapter.ts` — but since it just logs to console, no change is needed there (it already logs template key + data).

- [ ] **Step 2: Commit**

```bash
git add src/modules/integration/infrastructure/SmtpEmailNotificationAdapter.ts
git commit -m "feat: add user-invite and password-reset email templates"
```

---

## Task 15: Seed superadmin + permissions

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add bcrypt import and user/permission seed functions**

At the top of `prisma/seed.ts`, add:

```typescript
import bcrypt from 'bcrypt';
```

Before the `main()` function, add:

```typescript
// ─── Users + Permissions ───────────────────────────────────

const SUPERADMIN_USER_ID = '00000000-0000-0000-0002-000000000001';

async function seedSuperadmin() {
  console.log('Seeding superadmin user...');

  const passwordHash = await bcrypt.hash('DentziAdmin2026!', 12);

  await prisma.user.upsert({
    where: { email: 'dev@dentzi.ai' },
    update: {},
    create: {
      id: SUPERADMIN_USER_ID,
      email: 'dev@dentzi.ai',
      name: 'Superadmin',
      role: 'SUPERADMIN',
      passwordHash,
      emailVerifiedAt: new Date(),
      active: true,
    },
  });

  console.log('  Created superadmin user (dev@dentzi.ai).');
}

async function seedPermissions() {
  console.log('Seeding permissions...');

  // Clear existing permissions
  await prisma.permission.deleteMany({});

  type P = { role: string; resource: string; action: string; scope: string };
  const perms: P[] = [];

  const resources = ['organizations', 'users', 'clinics', 'professionals', 'services', 'patients', 'appointments', 'conversations', 'settings', 'dashboard'];
  const actions = ['create', 'read', 'update', 'delete'];

  // SUPERADMIN: ALL on everything
  for (const resource of resources) {
    for (const action of actions) {
      perms.push({ role: 'SUPERADMIN', resource, action, scope: 'ALL' });
    }
  }

  // ADMIN: ORG on most things, no organizations
  const adminResources = ['users', 'clinics', 'professionals', 'services', 'patients', 'appointments', 'conversations', 'settings', 'dashboard'];
  for (const resource of adminResources) {
    for (const action of actions) {
      perms.push({ role: 'ADMIN', resource, action, scope: 'ORG' });
    }
  }

  // PROFESSIONAL: OWN read on limited resources
  perms.push({ role: 'PROFESSIONAL', resource: 'professionals', action: 'read', scope: 'OWN' });
  perms.push({ role: 'PROFESSIONAL', resource: 'services', action: 'read', scope: 'ORG' });
  perms.push({ role: 'PROFESSIONAL', resource: 'patients', action: 'read', scope: 'OWN' });
  perms.push({ role: 'PROFESSIONAL', resource: 'appointments', action: 'read', scope: 'OWN' });
  perms.push({ role: 'PROFESSIONAL', resource: 'dashboard', action: 'read', scope: 'OWN' });

  // ATTENDANT: ORG read on patients, ORG CRUD on appointments, ORG read conversations, OWN dashboard
  perms.push({ role: 'ATTENDANT', resource: 'patients', action: 'read', scope: 'ORG' });
  perms.push({ role: 'ATTENDANT', resource: 'appointments', action: 'create', scope: 'ORG' });
  perms.push({ role: 'ATTENDANT', resource: 'appointments', action: 'read', scope: 'ORG' });
  perms.push({ role: 'ATTENDANT', resource: 'appointments', action: 'update', scope: 'ORG' });
  perms.push({ role: 'ATTENDANT', resource: 'conversations', action: 'read', scope: 'ORG' });
  perms.push({ role: 'ATTENDANT', resource: 'dashboard', action: 'read', scope: 'OWN' });

  await prisma.permission.createMany({
    data: perms.map((p) => ({
      role: p.role as any,
      resource: p.resource,
      action: p.action,
      scope: p.scope as any,
    })),
  });

  console.log(`  Created ${perms.length} permissions.`);
}
```

- [ ] **Step 2: Add to cleanup function**

In the `cleanup` function, add at the very beginning (before other deletes):

```typescript
  await prisma.permission.deleteMany({});
  await prisma.user.deleteMany({});
```

- [ ] **Step 3: Call seed functions in main()**

In the `main()` function, add after `await seedAvailabilityRules();`:

```typescript
  await seedSuperadmin();
  await seedPermissions();
```

- [ ] **Step 4: Run the seed to verify**

```bash
npx prisma db seed
```

Expected: seed completes with "Created superadmin user" and "Created N permissions" messages.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed superadmin user and permission matrix"
```

---

## Task 16: TypeScript verification

- [ ] **Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 2: Run the dev server and verify**

```bash
npm run dev
```

Manual checks:
1. Open `http://localhost:3000/backoffice` — should redirect to `/login`
2. Login with `dev@dentzi.ai` / `DentziAdmin2026!` — should redirect to `/backoffice`
3. Backoffice header shows "Superadmin" and "SUPERADMIN" role
4. Click logout — should redirect to `/login`
5. Open `/forgot-password` — form works, shows success message
6. Open `/accept-invite?token=invalid` — shows "Convite invalido" error

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during auth verification"
```
