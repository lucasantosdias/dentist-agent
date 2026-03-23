# Dentzi AI — Complete Architectural Walkthrough

**Date:** 2026-03-20
**Version:** Current state after recent additions
**Author:** Architecture review

---

## 1. Executive Overview

Dentzi is a **multi-tenant conversational assistant for dental clinics**, built as a Next.js 15 App Router application with TypeScript. It receives patient messages via a simulated channel ("sim"), classifies intent using an LLM (or heuristic fallback), and orchestrates deterministic business flows — primarily appointment scheduling.

The runtime flow is: **message in → classify → orchestrate → respond**. The LLM only classifies and extracts entities. All business decisions (scheduling, cancellation, slot availability) are made by backend code. The LLM never confirms appointments or decides availability.

The architecture is **DDD + Clean Architecture as a Modular Monolith**. Each module (patients, conversations, scheduling, etc.) has its own `domain/`, `application/`, and `infrastructure/` layers. Modules communicate through typed port interfaces, not direct imports of infrastructure.

**What it solves today:** A patient texts "quero marcar uma limpeza" to a clinic's channel. The system identifies the booking intent, progressively collects missing data (name, care type, date/time), checks professional availability across a 5-layer availability engine, creates a temporary slot hold, and confirms the appointment when the patient agrees. Each clinic has isolated data, its own services/professionals, and configurable bot behavior.

**Stack:** Next.js 15, TypeScript, Prisma 6.4, PostgreSQL 16, Zod, Ant Design (backoffice UI). Docker Compose for local dev (Postgres + Redis + App). Ollama/qwen2.5:7b-instruct as the primary LLM, with a heuristic MockLlmInterpreter as fallback.

---

## 2. End-to-End Request Flow

Here is exactly what happens when a user sends `"boa tarde, quero fazer uma limpeza"` to `/api/channels/sim/inbound`:

**Step 1 — HTTP Entry** (`src/app/api/channels/sim/inbound/route.ts`)
The Next.js route handler receives the POST body, validates it with `inboundMessageSchema` (Zod: requires `channel: "sim"`, `external_user_id`, `message_id`, `text`). If `clinic_id` is absent, it defaults to `DEFAULT_CLINIC_ID` from env. Calls `getContainer()` to get the singleton DI container, then calls `container.conversationOrchestrator.execute(clinicId, parsedData)`.

**Step 2 — Idempotency** (Orchestrator line ~49)
Checks `ProcessedInboundMessage` table for the (channel, external_user_id, message_id) tuple. If found, returns the cached response. This prevents duplicate processing if the same message arrives twice.

**Step 3 — Patient Resolution** (line ~58)
Looks up patient by `(clinicId, "sim", external_user_id)`. If none exists, creates one with state `LEAD_NEW`, no name. Calls `patient.touchInteraction()` to update `lastInteractionAt`.

**Step 4 — Conversation Resolution** (line ~66)
Loads the latest conversation for this patient+channel. If none exists or the last one is `FINALIZADA`, creates a new conversation with state `AUTO`, attempts=0, empty collectedData.

**Step 5 — Store Inbound Message** (line ~76)
Creates a Message record with direction=INBOUND. If this exact message_id was already stored (duplicate), attempts to replay the last outbound message.

**Step 6 — Increment Attempts** (line ~102)
`conversation.touchMessage()` increments `attempts` and sets `lastMessageAt`.

**Step 7 — Load Context in Parallel** (line ~105)
Three async calls run simultaneously:
- `messageRepository.listLastMessages(conversation.id, 20)` — recent message history for LLM context
- `catalogSnapshotPort.execute(clinicId)` — services and professionals for this clinic
- `clinicSettingsPort.findByClinicId(clinicId)` — clinic-specific configuration (templates, hours, tone)

**Step 8 — LLM Interpretation** (line ~112)
Calls `llmInterpreter.interpret()` with: the user text, current timestamp, timezone, patient state, conversation state, current intent, collected data, known patient data, catalog snapshot, and recent messages.

The interpreter (Ollama, OpenAI, or Mock) returns an `LlmInterpretation`: intent, stage, entities (full_name, service_code, datetime_iso, etc.), missing fields, optional suggested_next_question.

For our example, the mock classifier detects "gostaria" → `BOOK_APPOINTMENT`, extracts `service_code: "LIMPEZA"` from catalog matching.

**Step 9 — Entity Merging** (line ~132)
`mergeEntitiesIntoCollectedData()` takes the conversation's existing `collectedData` and merges non-null entities from the LLM output. If the LLM extracted `full_name`, the patient record is updated. If the patient already has a name in the DB, it flows into `collectedData`.

After this step, `collectedData` = `{ service_code: "LIMPEZA" }` (name still missing).

**Step 10 — Backend Safety Guards** (lines ~149-177)
Three guards run in sequence:
1. **ServiceInfoDetector** — If the LLM returned UNKNOWN/GREETING/SMALL_TALK but the text matches an interrogative pattern + a catalog service, reclassify to `SERVICE_INFO`.
2. **TALK_TO_HUMAN context guard** — If TALK_TO_HUMAN was classified but it's a fresh conversation and the text matches opening patterns, downgrade to GREETING.
3. **Confirmation hold guard** — If the conversation is awaiting hold confirmation and the text looks like a confirmation, force to BOOK_APPOINTMENT + USER_CONFIRMED_DETAILS.

**Step 11 — Effective Intent Resolution** (line ~190)
`resolveEffectiveIntent()` applies: if LLM said UNKNOWN but the conversation has an active transactional intent, keep the transactional intent. Otherwise, use the LLM intent as-is. Here: `BOOK_APPOINTMENT`.

**Step 12 — Missing Requirements** (line ~198)
`resolveMissingForBooking(collectedData)` determines what fields are still needed. With only `service_code` present, it returns `["full_name", "care_type", "datetime_iso"]`.

**Step 13 — Intent Routing** (line ~208)
The switch statement routes `BOOK_APPOINTMENT` to the booking handler branch. Since `bookingMissing.length > 0`, it enters the progressive collection path:
- Sets `currentFunnelStep` = "COLLECTING_DATA"
- Calls `buildNextQuestion(["full_name", "care_type", "datetime_iso"], "BOOK_APPOINTMENT", ...)` → "Qual é o seu nome completo?"

**Step 14 — Conversational Acknowledgment** (line ~462)
`detectConversationalSignals()` scans the raw text and finds: `hasGreeting: true, greetingReply: "Boa tarde!", hasServiceMention: true, mentionedServiceName: "Limpeza"`.

`buildAcknowledgmentPrefix()` checks: intent is not GREETING, attempts is 1 (first turn) → builds prefix: `"Boa tarde! Posso te ajudar com a Limpeza."`.

The response `reply_text` becomes: `"Boa tarde! Posso te ajudar com a Limpeza. Qual é o seu nome completo?"`.

**Step 15 — Persist** (line ~479)
Three parallel writes: save patient, save conversation, create outbound Message record.

**Step 16 — Store Idempotency Record** (line ~490)
Save the full response to `ProcessedInboundMessage` for future duplicate detection.

**Step 17 — Return**
Returns `{ reply_text, conversation_state: "AUTO", patient_state: "LEAD_NEW" }`.

---

## 3. Architecture Layers and Responsibilities

### Routes / Controllers (`src/app/api/`)
Thin Next.js App Router handlers. They parse HTTP, validate with Zod, delegate to the container, and format the response. No business logic. The main entry point is `POST /api/channels/sim/inbound`. Admin routes at `/api/admin/*` provide CRUD. Debug routes at `/api/debug/*` expose raw entity state.

### Application Layer (`src/modules/*/application/`)
**Use cases** — single-purpose classes with an `execute()` method. Each encapsulates one business operation. The ConversationOrchestrator is the main use case — it coordinates the full message processing pipeline.

**Ports** — TypeScript interfaces that define what the use case needs from the outside world. `PatientRepositoryPort`, `LlmInterpreterPort`, `SchedulingAvailabilityPort`, etc. These are the dependency inversion seam.

**DTOs** — plain type definitions for data transfer. `InboundMessageCommand`, `LlmInterpretation`, `SchedulingDtos`.

### Domain Layer (`src/modules/*/domain/`)
**Entities** — classes with identity and lifecycle. `Patient`, `Conversation`, `Appointment`, `SlotHold`. They encapsulate state transitions and invariants.

**Domain Services** — pure functions that implement domain rules without owning state. `RequirementResolver`, `EntityMerger`, `NextQuestionBuilder`, `ServiceInfoDetector`, `ConversationalSignals`, `ResponseComposer`.

**Value Objects / Enums** — `PatientState`, `ConversationState`, `AppointmentStatus`, `SlotHoldStatus`. Centralized in `src/shared/domain/constants.ts`.

### Infrastructure Layer (`src/modules/*/infrastructure/`)
**Prisma Repositories** — implement the port interfaces using Prisma Client.

**LLM Interpreters** — `OllamaLlmInterpreter`, `OpenAiLlmInterpreter`, `MockLlmInterpreter`. All implement `LlmInterpreterPort`.

**Google Calendar Adapter** — `GoogleCalendarAdapter` implements `GoogleCalendarPort`.

### Shared Layer (`src/shared/`)
- `domain/constants.ts` — centralized enums, pattern arrays, type definitions
- `result.ts` — `Result<T, E>` algebraic type for error handling
- `time.ts` — timezone-aware date utilities

### DI Container (`src/server/container.ts`)
Manual dependency injection. A `getContainer()` function constructs all dependencies once, then caches. No framework.

---

## 4. Main Modules / Subsystems

### Conversations Module — Stable, core of the system
The brain. `ConversationOrchestrator` is the central use case (~670 lines). Domain services are pure functions the orchestrator composes. **State: mature, well-tested (319 tests), actively evolved.**

### Patients Module — Stable, simple
Patient lifecycle management. `Patient` entity with state machine. Identified by `(clinicId, channel, externalUserId)`. Created automatically on first message. **State: stable.**

### Clinic Module — Partially implemented
`Clinic` entity with CRUD. `ClinicSettings` entity for per-clinic templates, hours, tone, fallback behavior. **Recently added, works but no admin UI for editing settings yet.** Falls back to defaults if no DB row exists.

### Scheduling Module — Most complex, stable
Full appointment lifecycle. Multi-step booking flow. 5-layer availability engine. Slot holds with TTL. Cancellation and presence confirmation. **State: stable, well-designed, most architecturally solid module.**

### Catalog Module — Stable, simple
Services and Professionals. Returns clinic-specific catalog for LLM context.

### AI Module — Functional, actively improved
Three LLM interpreter implementations. Mock significantly improved with 11-layer priority rules and centralized patterns. Classification prompt is the single source of truth. **State: functional, actively evolving.**

### Integration Module — Implemented, conditionally active
Google Calendar integration with OAuth, watch channels, incremental sync, outbox pattern. Degrades gracefully when credentials are not configured. **State: implemented but only active with Google credentials.**

### Knowledge Module — Scaffolded, not wired
Port, repository, and database table exist. SQL-first retrieval strategy with tenant isolation. pgvector prepared but commented out. **Not yet wired into the orchestrator. No data seeded.**

### Backoffice / Simulator — Functional UI
Ant Design admin pages. The test-mode simulator sends messages to the real backend endpoint. **Uses the exact same orchestration path as production.**

---

## 5. Domain Model Explanation

### Patient
- **Identity:** `(clinicId, defaultChannel, externalUserId)`
- **State machine:** LEAD_NEW → LEAD_QUALIFIED (name set) → ACTIVE (appointment confirmed) → INACTIVE
- Created automatically on first inbound message

### Conversation
- **State machine:** AUTO → WAITING (hold created) → HUMAN (escalated) → FINALIZADA (terminal)
- **Transient state:** currentIntent, collectedData (JSON accumulating entities), missingRequirements, currentFunnelStep
- **`attempts`:** Incremented every message. Used for fallback escalation threshold.

### Appointment
- **Status:** AGENDADA → CONFIRMADA or CANCELADA or NO_SHOW / COMPARECEU
- Created only by ConfirmAppointmentUseCase (converting a held slot)

### SlotHold
- **Temporary reservation** with 10-min TTL
- **Status:** HELD → CONVERTED or EXPIRED or RELEASED
- One active hold per conversation

### Service
- Per-clinic, with code, displayName, durationMinutes, optional price

### Professional
- Global entity linked to clinics via join table
- Has: availability rules, exceptions, optional Google Calendar

### Deterministic vs AI-assisted
- **AI-assisted:** Intent classification, entity extraction
- **Deterministic:** Everything else (field resolution, availability, holds, state transitions, response templates)

---

## 6. AI/LLM Behavior Today

### Classification
The LLM receives user text + context and returns structured JSON: intent, stage, entities, missing fields. 16 intents recognized. System prompt contains only classification rules, no business data.

### Extraction
Entities: full_name, phone_number, care_type, insurance_name, service_code, primary_reason, symptom, professional_name, preferred_date, preferred_time, datetime_iso, appointment_id, urgency_level.

### Fallback Chain
Ollama → 2 retries → MockLlmInterpreter (heuristic). OpenAI has the same pattern.

### Backend Safety Guards (post-classification)
1. ServiceInfoDetector — catches misclassified service queries
2. TALK_TO_HUMAN context guard — prevents premature escalation
3. Confirmation hold guard — detects booking confirmations

### Response Generation
**There is no LLM-based response generation.** All responses are deterministic — templates, static strings, or catalog data. The ConversationalSignals module adds acknowledgment prefixes but these are also deterministic.

---

## 7. Scheduling Flow Explanation

### Booking Path (happy case)
1. User expresses booking intent → BOOK_APPOINTMENT
2. `resolveMissingForBooking()` identifies missing fields
3. Progressive collection: ask name → care type → date/time
4. All fields collected → `HandleSchedulingIntentUseCase`
5. `StartSchedulingUseCase` normalizes, `ProposeSlotsUseCase` finds slots
6. `CreateHoldUseCase` creates 10-min hold
7. User confirms → `ConfirmAppointmentUseCase` converts hold to appointment
8. Patient transitions to ACTIVE

### Availability (5-Layer Stack)
1. Availability Rules (weekly recurring windows)
2. Availability Exceptions (blocks)
3. Existing Appointments (conflicts)
4. Active Slot Holds (temporary reservations)
5. Google Calendar free/busy (if connected)

### Cancellation
Finds upcoming appointments, cancels with reason, creates outbox event for calendar sync.

### What is robust
Availability calculation, hold-based race prevention, idempotent processing, working hours enforcement.

### What is incomplete
RESCHEDULE not properly implemented (treated as new booking), no auto-expiration job for holds.

---

## 8. Multi-Tenant / Clinic Separation

### Data Layer — Enforced
Every entity has clinicId. Patient unique constraint includes clinicId. Catalog filtered by clinic.

### Configuration — Partially Enforced
ClinicSettings is per-clinic with defaults. But SchedulingPolicies reads from global env vars, not per-clinic settings.

### Knowledge — Prepared but unused
KnowledgeDocument supports nullable clinicId with universal fallback. Not yet wired.

### Still globally shared
SchedulingPolicies (working hours, hold TTL), system prompt, LLM provider/model.

---

## 9. Current Response Composition

### Four strategies in use
1. **Template-based** (ClinicSettings) — greeting, booking questions, escalation, fallback
2. **Static strings** — scheduling responses, informational handlers (~15 hardcoded Portuguese strings in HandleSchedulingIntentUseCase)
3. **Catalog-derived** — service lists, service info (name + duration)
4. **Acknowledgment prefix** (ConversationalSignals) — first-turn greeting echo + service mention

### What is NOT happening
- No LLM-generated responses
- No RAG-retrieved knowledge
- HandleSchedulingIntentUseCase strings not yet migrated to templates

---

## 10. Simulator and Debugging Tools

### Test-Mode (`/backoffice/test-mode`)
Full chat UI sending real HTTP requests to `/api/channels/sim/inbound`. Same orchestration path as production. Three debug tabs: logs, history, config.

### Debug API Endpoints
`/api/debug/conversations/[id]`, `/patients/[id]`, `/appointments/[id]` — raw entity state.

### What it may hide
If Ollama is down, the mock classifier is active. Simulator reflects mock behavior, which may differ from real LLM behavior on ambiguous messages.

---

## 11. What Changed Recently

| Addition | Status |
|----------|--------|
| Prompt stabilization (single source of truth) | Fully integrated |
| ClinicSettings system (per-clinic templates, hours, tone) | Fully integrated, no admin UI |
| Knowledge layer (table, repository, port) | Scaffolded, not wired |
| SERVICE_INFO intent + ServiceInfoDetector | Fully integrated and tested |
| Conversational level improvements (opening, help-seeking, handoff patterns) | Fully integrated and tested |
| ConversationalSignals (acknowledgment prefix for mixed messages) | Fully integrated and tested |
| InsurancePlan / ReturnCycleRule tables | Schema only, no logic |
| pgvector preparation | SQL migration ready, commented out |
| Test suite | 319 tests across 26 suites |

---

## 12. Current Technical Debt

| Issue | Impact |
|-------|--------|
| SchedulingPolicies reads global env, not per-clinic ClinicSettings | All clinics share same working hours for availability |
| ~15 hardcoded Portuguese strings in HandleSchedulingIntentUseCase | Can't customize per clinic, some missing accents |
| Knowledge layer not wired | Service info responses are thin (name + duration only) |
| InsurancePlan/ReturnCycleRule empty | Can't answer insurance questions with real data |
| RESCHEDULE_APPOINTMENT not properly implemented | Treated as new booking |
| No automated SlotHold expiration job | Expired holds accumulate |
| LlmInterpretation DTO duplicates constants | Must keep two files in sync manually |
| DB uses prisma db push, not migrations | No rollback, manual coordination needed |

---

## 13. Practical Mental Model

**Think of the system as a dental clinic receptionist who follows a strict protocol binder.**

The **ConversationOrchestrator** is the receptionist. Every message arrives at their desk. They:

1. **Look up the patient** (or create a new file)
2. **Hand the message to the interpreter** (LLM or mock) who reads it and writes a classification slip
3. **Check the classification** against backend safety guards
4. **Open the protocol binder** (the switch statement) and follow the procedure for that intent type
5. For bookings: **check the requirements clipboard** — what data do we still need?
6. For everything else: **read the response from the template card**
7. Before handing the response back, **add a polite greeting** if the patient said hello
8. **File everything** (persist to database)

The LLM is the **translator/classifier** — it understands Portuguese and figures out what the patient wants. It never decides what to do.

The **scheduling engine** is like a **separate office in the back** — checks the appointment book, places tentative holds, sends back confirmation options.

The **clinic settings** are like a **customization sheet** — each clinic can choose their greeting, tone, hours display. But the protocol itself is the same for all clinics.

The **knowledge base** is like a **reference library** that's been built but the receptionist hasn't been trained to consult it yet.

---

## 14. Glossary

| Concept | Meaning |
|---------|---------|
| **Orchestrator** | ConversationOrchestrator — central coordinator processing every inbound message |
| **Interpretation** | LLM's structured JSON output: intent + stage + entities |
| **Mock Interpreter** | Heuristic keyword/regex classifier used as fallback |
| **Effective Intent** | Final intent after backend guards and context resolution |
| **Collected Data** | JSON on Conversation accumulating entities across turns |
| **Missing Requirements** | Field names still needed to complete a transaction |
| **Funnel Step** | Position in booking funnel: COLLECTING_DATA → AWAITING_CONFIRMATION → COMPLETED |
| **Slot Hold** | 10-minute temporary reservation preventing race conditions |
| **Availability Stack** | 5-layer filtering: rules → exceptions → appointments → holds → Google Calendar |
| **Clinic Settings** | Per-clinic configuration: templates, tone, hours, thresholds |
| **Safety Guard** | Backend logic correcting misclassifications post-LLM |
| **Conversational Signals** | Secondary signals (greeting, service mention) for acknowledgment |
| **Template Key** | Named response template in ClinicSettings |
| **Outbox Pattern** | Calendar events queued for async Google Calendar sync |
| **Channel** | Communication channel identifier (currently only "sim") |
| **ProcessedInboundMessage** | Idempotency cache for duplicate prevention |
