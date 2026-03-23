# Dentist Agent MVP (DDD + Clean Architecture)

Production-oriented MVP for an AI-powered dental clinic secretary agent.

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL (Docker Compose)
- Prisma ORM
- Zod runtime validation

## LLM Provider

- `LLM_PROVIDER=openai`: uses OpenAI API (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`)
- `LLM_PROVIDER=mock`: local heuristic interpreter for development without external API

Notes:

- LLM is used only for intent/entity extraction.
- Appointment confirmation is always deterministic in backend use cases.

## Bounded Contexts

- `Patients` (Identity & lifecycle)
- `Conversations` (conversation/message history + orchestration)
- `Scheduling` (appointments, slot holds, availability, policies)
- `Catalog` (services, professionals, skills mapping)
- `AI` (LLM interpretation only; no business decisions)
- `Integration` (calendar outbox only)

## Architecture

Each BC is split by layer:

- `domain/` pure business objects and policies
- `application/` use cases and ports
- `infrastructure/` Prisma and external adapters
- `adapters/` transport-level DTO/Zod schemas

API route handlers are thin adapters only.

## Setup

1. Copy envs:

```bash
cp .env.example .env
```

If you do not want to call external LLM during development, set:

```bash
LLM_PROVIDER="mock"
```

2. Start infra + app with live reload:

```bash
docker compose up --build
```

Notes:

- App runs at `http://localhost:3000`.
- Live reload works via bind mount + polling (`CHOKIDAR_USEPOLLING`/`WATCHPACK_POLLING`).
- Inside Docker network, app uses `DATABASE_URL=...@postgres:5432/...`.
- Working hours are configurable via `WORKING_HOUR_START` / `WORKING_HOUR_END` (default `08:00-19:00`).
- Time offset for scheduling calculations is configurable via `APP_UTC_OFFSET_MINUTES` (default `-180`).

3. (Optional, local run outside Docker) Install deps:

```bash
npm install
```

4. Create DB schema and Prisma client:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

5. Seed catalog data:

```bash
npm run prisma:seed
```

6. Run app:

```bash
npm run dev
```

## Postman Simulation

Endpoint:

- `POST http://localhost:3000/api/channels/sim/inbound`

Body example:

```json
{
  "channel": "sim",
  "external_user_id": "user_001",
  "message_id": "msg_001",
  "text": "quero marcar limpeza terca as 15h"
}
```

Conversation progress tip:

- Keep `external_user_id` fixed across turns (e.g. `user_001`).
- Change `message_id` for each new inbound message (`msg_001`, `msg_002`, ...).
- Reusing the same `message_id` intentionally returns the cached response (idempotency).

Response shape:

```json
{
  "reply_text": "...",
  "conversation_state": "AUTO|WAITING|HUMAN|FINALIZADA",
  "patient_state": "LEAD_NEW|LEAD_QUALIFIED|LEAD_INACTIVE|ACTIVE|INACTIVE",
  "appointment": {
    "id": "...",
    "status": "AGENDADA|CONFIRMADA|CANCELADA|NO_SHOW|COMPARECEU",
    "starts_at": "...",
    "ends_at": "...",
    "professional_name": "...",
    "service_code": "..."
  }
}
```

Notes:

- Dedupe key is `(channel, external_user_id, message_id)`.
- Re-sending same `message_id` returns previous processed response.
- LLM never confirms appointments; confirmation is deterministic backend logic only.

## Deterministic Gatekeeper Rules

Appointment is only created when all conditions are met:

- required data exists (service/professional/datetime/name)
- professional can execute selected service
- slot availability revalidated
- hold exists and is converted
- appointment persisted
- outbox record persisted

## Outbox (Prepared)

`calendar_outbox` records are created on:

- appointment creation (`CREATE_EVENT`)
- appointment cancellation (`CANCEL_EVENT`)

No Google Calendar call is implemented yet.
# dentist-agent
