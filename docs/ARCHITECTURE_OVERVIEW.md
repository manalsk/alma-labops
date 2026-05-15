# ALMA LabOps — Architecture Overview

---

## 1. System Summary

ALMA LabOps is an AI-assisted laboratory operations platform built as a two-tier web application: a Next.js frontend and a FastAPI backend, both backed by Supabase (PostgreSQL, Auth, Storage, and pgvector). The two services communicate exclusively over REST. There is no shared code, no server actions that bypass the backend, and no frontend-to-database writes.

The AI layer is backend-only — the frontend never calls OpenAI directly, never holds an API key, and never generates content autonomously. All AI interactions are user-triggered and logged.

---

## 2. High-Level Structure

```
alma-labops/
├── frontend/                    Next.js 16, TypeScript, TailwindCSS v4, shadcn/ui
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/    Login page with demo role buttons
│       │   └── (dashboard)/     8 protected pages + shared layout
│       ├── components/          Domain components (inventory, tasks, packages, KB, copilot…)
│       ├── hooks/               Data hooks per domain (useInventory, useTasks, useCopilot…)
│       ├── lib/
│       │   ├── api/client.ts    Typed REST client (all backend calls)
│       │   ├── supabase/        Browser Supabase client (auth only, anon key)
│       │   └── rbac.ts          Frontend permission helpers (UI gating only)
│       ├── contexts/            UserProfileContext — profile injected once at layout
│       └── types/index.ts       All TypeScript types
│
├── backend/                     FastAPI, Python 3.12, uv
│   └── app/
│       ├── main.py              App entry, CORS, /health
│       ├── config.py            pydantic-settings env config
│       ├── dependencies.py      JWT validation, get_current_user, require_permission
│       ├── middleware/rbac.py   Permission enforcement (ROLE_BASE_PERMISSIONS + extras)
│       ├── models/auth.py       CurrentUser, ProfileResponse Pydantic models
│       ├── db/supabase.py       Supabase service-role client factory
│       ├── api/v1/              Domain routers (auth, inventory, tasks, procurement…)
│       ├── services/            Business logic layer (one service class per domain)
│       └── ai/                  All AI modules — isolated, async, backend-only
│           ├── client.py        Singleton AsyncOpenAI client
│           ├── package_vision.py  GPT-4o Vision extraction
│           ├── rag_assistant.py   RAG Q&A + embeddings
│           └── copilot.py         Operational copilot
│
├── supabase/migrations/         Ordered SQL migrations (001–008)
├── evals/                       Manual AI eval cases (JSON)
└── docs/                        Specs and architecture documentation
```

---

## 3. Frontend Architecture

### Layout and Routing

All authenticated pages live under the `(dashboard)` route group. The layout server component (`app/(dashboard)/layout.tsx`) fetches the user profile and permissions server-side on every navigation, then passes a typed `UserProfile` object into `AppLayout`. This means the profile is never stale and no client-side profile fetching is needed.

The `UserProfileContext` wraps the client subtree so any component can call `useUserProfile()` without prop drilling.

### Data Hooks

Each domain has a dedicated hook (`useInventory`, `useTasks`, `useProcurement`, `usePackages`, `useKnowledgeBase`, `useCopilot`, `useAuditLogs`). Hooks:

- call the FastAPI backend via `apiClient` with the Supabase JWT
- manage local state for their domain
- expose action functions that call the API and refresh state on success
- are never called server-side — all data fetching is client-side after hydration

### RBAC on the Frontend

Frontend RBAC (`src/lib/rbac.ts`) is **UI gating only** — it controls which buttons, tabs, and sections are rendered. It does not provide security. Real authorization happens in the backend on every request. Frontend RBAC uses the same permission model as the backend but is never the source of truth.

```typescript
// Example: frontend permission check
const canApprove = hasPermission(profile.role, 'approve_purchase_request', profile.permissions);
```

---

## 4. Backend Architecture

### Request Lifecycle

```
Browser
  │
  ├─ Authorization: Bearer <supabase_jwt>
  ▼
FastAPI Router
  │
  ├─ get_current_user()         — validates JWT via Supabase, loads profile + permissions
  ├─ require_permission(...)    — enforces role + delegated permissions, returns 403 if denied
  ├─ Domain Router              — route handler
  │    └─ Service Layer         — business logic, DB operations, audit logging
  │         └─ Supabase (service role) — reads/writes DB
  │
  └─ Response → Browser
```

### Service Layer

Each domain has a service class that owns its business logic. Routers are thin — they validate HTTP concerns (request parsing, status codes) and delegate to the service. Services handle:

- database reads and writes via the Supabase service role client
- audit log writes (`audit_logs` and `ai_audit_logs`)
- domain invariant enforcement (e.g. blocking duplicate actions, computing statuses)

This separation means business logic is testable independently of HTTP concerns.

### Permission Model

Three base roles: `pi`, `researcher`, `student`. Each role has a fixed set of base permissions defined in `app/middleware/rbac.py`. Additional permissions can be delegated to individual users via the `user_permissions` table (e.g. a researcher can be granted `view_audit_logs` by the PI without changing their role).

The `require_permission()` factory returns a FastAPI dependency that checks both the role's base permissions and any user-specific granted permissions. A 403 is raised if neither covers the required permission.

```python
# Example: endpoint requiring manage_inventory
@router.post("/")
async def create_item(
    body: CreateItemBody,
    current_user: CurrentUser = require_permission("manage_inventory"),
    db: Client = Depends(get_db),
):
    ...
```

---

## 5. Supabase Architecture

Supabase serves three distinct functions:

| Function | Who uses it | Key detail |
|---|---|---|
| Auth (JWT) | Frontend + backend | Frontend issues tokens; backend validates them |
| PostgreSQL (+ pgvector) | Backend only | Service role key is backend-only |
| Storage | Backend only | All file uploads go through the backend; signed URLs generated server-side |

Row Level Security (RLS) is enabled on all tables. The backend uses the service role key, which bypasses RLS — but all permission checks happen in the application layer before any DB call. RLS serves as a defense-in-depth layer for direct database access.

The frontend's Supabase client uses only the anon key, which is safe to expose. It is used exclusively for authentication (sign in, sign out, session refresh) — never for direct data reads or writes.

---

## 6. AI Architecture

### Core Principle: AI is a Backend Service

All AI calls originate from the backend. The OpenAI API key lives in `backend/.env` and is never referenced in any frontend code or environment variable. The frontend submits a question to a backend endpoint; the backend builds context, calls OpenAI, and returns a structured response.

```
User types question in browser
  │
  └─ POST /api/v1/copilot/ask  (JWT required)
       │
       └─ Backend: build context from DB → call OpenAI → log interaction → return answer
```

### Three AI Systems

**1. Vision Extraction (`package_vision.py`)**

GPT-4o Vision receives a package image URL and returns structured JSON (item name, vendor, quantity, catalog number, category, storage condition, confidence). Two modes:

- `mocked` (default): deterministic extraction keyed on URL pattern — no API call, instant, zero cost. Used for all seeded demo data.
- `live_ai`: real GPT-4o call. Requires explicit user selection and is logged with token count.

The extracted result is always a draft — it is never applied to inventory automatically.

**2. Knowledge Base RAG Assistant (`rag_assistant.py`)**

Documents are chunked (≈800 characters with overlap), embedded with `text-embedding-3-small`, and stored in a `document_chunks` table with a `vector(1536)` column. A pgvector IVFFlat index (cosine, lists=5) handles similarity search.

At query time:
1. The question is embedded using the same model
2. A Supabase RPC (`search_kb_chunks`) retrieves the top-5 most similar chunks, filtered by the user's RBAC-permitted visibility levels
3. The retrieved chunks are passed to `gpt-4.1-mini` with a strict system prompt that prohibits answering from outside the provided context
4. The answer, token usage, and source references are returned and logged to `rag_queries`

RBAC visibility is enforced at the retrieval step — a student's query will only search across `all_lab_members` documents regardless of what chunks exist in the database.

```
KB Ingestion Flow:
  Upload document → chunk text → embed chunks (text-embedding-3-small)
  → store vectors in document_chunks → mark document as indexed

RAG Query Flow:
  User question → embed question → pgvector similarity search (RBAC-filtered)
  → retrieve top-5 chunks → gpt-4.1-mini completion → log → return answer + sources
```

**3. Operational Copilot (`copilot.py`)**

The copilot does not use vector search. Instead, it builds structured context from live database queries at the time of each request — inventory status, open tasks, pending packages, procurement queue, and recent audit activity. This context is assembled by the service layer according to the user's role, then passed to `gpt-4.1-mini` with a strict system prompt.

The copilot is read-only and advisory. Its system prompt explicitly prohibits approving, rejecting, creating, or modifying any operational records. All interactions are logged to `copilot_queries`.

```
Copilot Query Flow:
  User question → build role-aware context from DB (inventory, tasks, procurement…)
  → gpt-4.1-mini completion → log to copilot_queries → return answer + context sources
```

The two AI systems cross-redirect:
- KB Assistant redirects live operational questions (inventory levels, task status) to the Copilot
- Copilot redirects SOP/policy/document questions to the KB Assistant

### AI Safety Constraints

Enforced in system prompts and architectural structure:

- AI never writes to the database
- All AI calls require explicit user action (no automatic triggering on page load or data change)
- AI cannot approve, reject, create, or modify operational records
- Injection resistance: context passed to AI is wrapped as read-only numbered reference sections with an explicit injection guard
- All AI interactions are logged with user, role, model, tokens, status, and response summary

---

## 7. Audit Logging Architecture

Two log tables serve different purposes:

**`audit_logs`** — operational events. Written by service layer functions after every significant create/update/delete operation. Fields: actor ID, actor role, event type, resource type, resource ID, description, metadata (JSONB), timestamp.

**`ai_audit_logs`** — AI interactions. Written after every AI tool call. Fields: user ID, role, prompt, tool called, model, response summary, status (success/error/blocked), tokens used, package ID (for vision extraction), metadata.

Both tables have RLS enabled. The audit log page (`/audit-logs`) is accessible to PIs by default; the PI can delegate `view_audit_logs` access to individual researchers via the Settings → Team tab.

---

## 8. Operational Data Flow Examples

### Package Intake Flow

```
1. Lab member uploads package photo (browser → multipart POST /incoming-packages/)
2. Backend stores image in Supabase Storage (package-images bucket), creates package row
3. User clicks "Run Extraction" → POST /incoming-packages/{id}/extract?mode=mocked
4. Backend calls package_vision.mock_extract() or live_extract(), stores result fields
5. Backend logs to ai_audit_logs with tokens, confidence, mode
6. User reviews extracted fields in drawer, optionally edits, clicks "Verify"
7. POST /incoming-packages/{id}/verify → backend validates, updates review_status
8. User clicks "Add to Inventory" → POST /incoming-packages/{id}/create-inventory
9. Backend creates inventory_items row, writes audit_log, links package to item
```

**Human decision points:** step 6 (review extraction), step 8 (confirm inventory creation). AI never creates inventory autonomously.

### KB Ingestion Flow

```
1. PI uploads document (POST /knowledge-base/ with title, visibility, category)
2. Backend stores file in Supabase Storage (kb-documents bucket), creates kb_documents row
3. Backend chunks document text (~800 chars), calls text-embedding-3-small per chunk
4. Chunk vectors inserted into document_chunks; document marked is_indexed=true
5. Document appears in KB table with chunk count and visibility badge
```

### Copilot Query Flow

```
1. User submits question via CopilotPanel (POST /copilot/ask)
2. Backend builds role-aware context:
   - All roles: inventory items + low-stock list (up to 30 items)
   - Researcher + PI: pending packages, procurement queue, recent audit activity
   - Student: their assigned tasks only (no procurement, no activity)
3. Context sections passed to gpt-4.1-mini with 10-rule system prompt
4. Backend checks response for refusal phrase, logs to copilot_queries
5. Answer + context_sources returned to frontend; rendered in slide-over panel
```
