# Auth System — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Scope:** User model, NextAuth.js credentials auth, login/logout, forgot/reset password, invite flow, middleware, seed, permission model
**Subsystem:** 1 of 4 (Auth → Org+RBAC → CRUDs operacionais → Transbordo)

## Context

The backoffice has zero authentication — all routes are publicly accessible, there is no User model, and the layout hardcodes "Admin" as the current user. This spec adds the foundational auth layer: user accounts, credential-based login, session management, password recovery, invite flow, and route protection via middleware.

Organization-level scoping (User → Organization → Clinics) is deferred to spec 2 (Org + RBAC). This spec handles authentication (who are you?) and basic role storage. Spec 2 will handle authorization (what can you do?).

## Data Model

### User

```
User
├── id: UUID (PK)
├── email: String (unique)
├── passwordHash: String? (null until password is set via invite)
├── name: String
├── role: UserRole (SUPERADMIN | ADMIN | PROFESSIONAL | ATTENDANT)
├── emailVerifiedAt: DateTime? (null until verified)
├── active: Boolean (default true)
├── professionalId: UUID? (FK → Professional, only for PROFESSIONAL role)
├── inviteToken: String? (SHA-256 hash of raw token)
├── inviteExpiresAt: DateTime?
├── resetToken: String? (SHA-256 hash of raw token)
├── resetExpiresAt: DateTime?
├── createdAt: DateTime
├── updatedAt: DateTime
```

Indexes: `(email)` unique, `(inviteToken)`, `(resetToken)`, `(professionalId)`.

### Permission

```
Permission
├── id: UUID (PK)
├── role: UserRole
├── resource: String (e.g., "patients", "appointments", "settings", "conversations", "professionals", "services", "organizations", "users")
├── action: String (e.g., "create", "read", "update", "delete")
├── scope: PermissionScope (OWN | ORG | ALL)
├── createdAt: DateTime
├── @@unique([role, resource, action])
```

Scope meanings:
- `OWN` — only the user's own records (e.g., professional sees own schedule)
- `ORG` — all records within the user's organization (admin scope)
- `ALL` — unrestricted (superadmin scope)

Permissions are seeded and can be changed via DB without code changes.

### Permission Seed Matrix

| Resource | Action | SUPERADMIN | ADMIN | PROFESSIONAL | ATTENDANT |
|---|---|---|---|---|---|
| organizations | create/read/update/delete | ALL | — | — | — |
| users | create/read/update/delete | ALL | ORG | — | — |
| clinics | create/read/update/delete | ALL | ORG | — | — |
| professionals | create/read/update/delete | ALL | ORG | OWN (read) | — |
| services | create/read/update/delete | ALL | ORG | ORG (read) | — |
| patients | create/read/update/delete | ALL | ORG | OWN (read) | ORG (read) |
| appointments | create/read/update/delete | ALL | ORG | OWN (read) | ORG (create/read/update) |
| conversations | read | ALL | ORG | — | ORG (read) |
| settings | read/update | ALL | ORG | — | — |
| dashboard | read | ALL | ORG | OWN | OWN |

Note: PROFESSIONAL gets `OWN` read on patients/appointments meaning only patients they have appointments with and their own appointments.

## NextAuth.js Configuration

### Strategy

- **Provider:** Credentials (email + password via `bcrypt.compare`)
- **Session:** JWT strategy (no session table needed)
- **Secret:** `NEXTAUTH_SECRET` env var
- **Pages:** Custom pages (not NextAuth defaults)

### Files

- `src/lib/auth.ts` — `authOptions` configuration, exported for reuse
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth API handler
- `src/types/next-auth.d.ts` — Type augmentation for session/token

### JWT Token Contents

```typescript
{
  userId: string;
  email: string;
  name: string;
  role: "SUPERADMIN" | "ADMIN" | "PROFESSIONAL" | "ATTENDANT";
  professionalId: string | null;
}
```

### Credentials Provider Logic

1. Find user by email
2. If not found → error "Email ou senha incorretos"
3. If `!user.active` → error "Conta desativada"
4. If `!user.emailVerifiedAt` → error "Verifique seu email primeiro"
5. If `!user.passwordHash` → error "Finalize seu cadastro pelo link de convite"
6. Compare password with `bcrypt.compare`
7. If mismatch → error "Email ou senha incorretos"
8. Return user data for JWT

## Middleware

**File:** `src/middleware.ts`

**Logic:**
1. Get JWT token via `getToken()` from `next-auth/jwt`
2. If path is public → allow
3. If no token → redirect to `/login`
4. If token exists → allow (role-based authorization deferred to spec 2)

**Public routes (no auth required):**
- `/login`
- `/forgot-password`
- `/reset-password`
- `/accept-invite`
- `/api/auth/*` (NextAuth endpoints)
- `/api/channels/*` (inbound messages from patients)
- `/api/integrations/*` (Google Calendar webhooks)

**Protected routes (require auth):**
- `/backoffice/*`
- `/api/admin/*`

**Matcher:** Applies to all routes except static files (`_next/static`, `_next/image`, `favicon.ico`).

## Pages

All auth pages live outside the `(backoffice)` route group — no sidebar, minimal layout.

### `/login`

- Fields: email, password
- Link: "Esqueci minha senha" → `/forgot-password`
- On success: redirect to `/backoffice`
- On error: inline error message
- Styling: centered card, Dentzi branding, Ant Design components

### `/forgot-password`

- Field: email
- On submit: POST `/api/auth/forgot-password`
- Always shows success message ("Se o email existir, enviaremos um link") — does not reveal if email exists
- Link: "Voltar ao login" → `/login`

### `/reset-password?token=X`

- Fields: nova senha, confirmar senha
- Validates: minimum 8 chars, passwords match
- On submit: POST `/api/auth/reset-password` with `{ token, password }`
- On success: "Senha redefinida" → redirect to `/login`
- On error (expired/invalid token): "Link expirado. Solicite um novo."

### `/accept-invite?token=X`

- On load: GET validates token, pre-fills user name (readonly)
- Fields: senha, confirmar senha
- On submit: POST `/api/auth/accept-invite` with `{ token, password }`
- Sets `passwordHash`, sets `emailVerifiedAt = now`, clears `inviteToken`
- On success: redirect to `/login` with "Conta criada com sucesso"
- On error (expired/invalid): "Convite expirado. Solicite um novo ao administrador."

## API Routes

### `POST /api/auth/forgot-password`

- Input: `{ email }`
- Logic:
  1. Find user by email
  2. If not found → return 200 anyway (no leak)
  3. Generate raw token: `crypto.randomBytes(32).toString("hex")`
  4. Hash token: `crypto.createHash("sha256").update(rawToken).digest("hex")`
  5. Save `resetToken` (hashed) and `resetExpiresAt` (now + 1 hour)
  6. Send email with link containing raw token
- Response: `{ ok: true }` always

### `POST /api/auth/reset-password`

- Input: `{ token, password }`
- Logic:
  1. Hash received token with SHA-256
  2. Find user where `resetToken = hashedToken AND resetExpiresAt > now`
  3. If not found → 400 "Token invalido ou expirado"
  4. Hash new password with `bcrypt.hash(password, 12)`
  5. Update `passwordHash`, clear `resetToken` and `resetExpiresAt`
- Response: `{ ok: true }`

### `POST /api/auth/accept-invite`

- Input: `{ token, password }`
- Logic:
  1. Hash received token with SHA-256
  2. Find user where `inviteToken = hashedToken AND inviteExpiresAt > now`
  3. If not found → 400 "Convite invalido ou expirado"
  4. Hash password with `bcrypt.hash(password, 12)`
  5. Update `passwordHash`, set `emailVerifiedAt = now`, clear `inviteToken` and `inviteExpiresAt`
- Response: `{ ok: true }`

### `GET /api/auth/validate-invite?token=X`

- Logic: hash token, find user, return `{ valid: true, name }` or `{ valid: false }`
- Used by `/accept-invite` page on load to pre-fill name

### `POST /api/admin/users/invite`

- Auth required: SUPERADMIN or ADMIN
- Input: `{ email, name, role, professionalId? }`
- Validation:
  - ADMIN can only create PROFESSIONAL or ATTENDANT
  - SUPERADMIN can create any role
  - Email must not already exist
  - If role is PROFESSIONAL, `professionalId` is required and must exist
- Logic:
  1. Create User with `passwordHash = null`, `emailVerifiedAt = null`
  2. Generate invite token (same pattern as reset token)
  3. Save hashed token + `inviteExpiresAt = now + 72h`
  4. Send invite email with raw token link
- Response: `{ id, email, role }`

## Seed

In `prisma/seed.ts`, after existing seeds:

```
User: Superadmin
├── email: dev@dentzi.ai
├── passwordHash: bcrypt("DentziAdmin2026!", 12)
├── name: "Superadmin"
├── role: SUPERADMIN
├── emailVerifiedAt: new Date()
├── active: true
├── professionalId: null
```

Permission table: seeded with full matrix from the table above. Each row is a `Permission` record with `(role, resource, action, scope)`.

## Email Templates

### Invite Email

- Subject: "Voce foi convidado para a Dentzi AI"
- Template key: `user-invite`
- Data: `{ name, role, invite_url }`
- Body: greeting with name, role badge, "Criar minha senha" button → `/accept-invite?token=X`
- Footer: "Este link expira em 72 horas."

### Password Reset Email

- Subject: "Recupere sua senha — Dentzi AI"
- Template key: `password-reset`
- Data: `{ name, reset_url }`
- Body: greeting, "Redefinir senha" button → `/reset-password?token=X`
- Footer: "Este link expira em 1 hora. Se voce nao solicitou, ignore este email."

Both templates render in `SmtpEmailNotificationAdapter` (extend `renderTemplate` method with the two new template keys).

## Backoffice Layout Updates

- Replace hardcoded "Admin" / "Gerente" with session data (`session.user.name`, `session.user.role`)
- Logout button calls `signOut()` from `next-auth/react`
- Wrap layout with `SessionProvider` from `next-auth/react`

## Env Variables

New variables to add to `env.ts` and `.env`:

```
NEXTAUTH_SECRET="random-64-char-string"
NEXTAUTH_URL="https://lionfish-app-w8ks9.ondigitalocean.app"  # or http://localhost:3000
```

## File Structure (new files)

```
src/
  lib/
    auth.ts                                    # authOptions config
  types/
    next-auth.d.ts                             # type augmentations
  middleware.ts                                 # route protection
  app/
    api/auth/
      [...nextauth]/route.ts                   # NextAuth handler
      forgot-password/route.ts                 # POST forgot password
      reset-password/route.ts                  # POST reset password
      accept-invite/route.ts                   # POST accept invite
      validate-invite/route.ts                 # GET validate invite token
    api/admin/users/
      invite/route.ts                          # POST create user + send invite
    (auth)/                                    # Auth pages route group (no sidebar)
      login/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
      accept-invite/page.tsx
      layout.tsx                               # Minimal centered layout
prisma/
  schema.prisma                                # User + Permission models + UserRole enum
  seed.ts                                      # Superadmin + permissions seed
```

## Modified files

```
src/
  config/env.ts                                # NEXTAUTH_SECRET, NEXTAUTH_URL
  app/(backoffice)/layout.tsx                  # SessionProvider, session data, signOut
  modules/integration/infrastructure/
    SmtpEmailNotificationAdapter.ts            # New email templates
  server/container.ts                          # (no changes needed for auth)
.env                                           # New env vars
.env.example                                   # New env vars documented
```

## Edge Cases

- User tries to login before accepting invite → "Finalize seu cadastro pelo link de convite"
- User tries to accept expired invite → "Convite expirado. Solicite um novo ao administrador."
- Forgot password for non-existent email → 200 OK (no information leak)
- Multiple forgot password requests → each one overwrites previous resetToken
- Deactivated user tries to login → "Conta desativada"
- Invite to existing email → 409 "Email ja cadastrado"
- ADMIN tries to create SUPERADMIN → 403 Forbidden
