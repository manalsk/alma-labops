# ALMA LabOps — Implementation Roadmap

---

## Phase 1 — Architecture Scaffold ✅

### Structure

```
alma-labops/
├── frontend/                   Next.js 16 app
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/   Login page (demo role buttons)
│       │   └── (dashboard)/    All 8 protected pages + shared layout
│       ├── components/
│       │   ├── layout/         AppSidebar, TopNav, AppLayout
│       │   └── ui/             14 shadcn/ui components
│       ├── config/env.ts       Centralized env var access
│       ├── types/index.ts      All TypeScript types (roles, inventory, etc.)
│       ├── lib/
│       │   ├── supabase/       Browser + server Supabase clients
│       │   ├── api/client.ts   Typed HTTP client for backend
│       │   └── rbac.ts         Frontend permission helpers
│       └── hooks/useAuth.ts    Auth state hook
│
├── backend/                    FastAPI app
│   └── app/
│       ├── main.py             App entry + CORS + /health endpoint
│       ├── config.py           pydantic-settings environment config
│       ├── dependencies.py     FastAPI deps (auth, db)
│       ├── api/v1/             Domain routers (auth, inventory, etc.)
│       ├── services/           Domain service classes (business logic)
│       ├── ai/                 Isolated AI modules
│       ├── db/supabase.py      Supabase client factory
│       └── middleware/rbac.py  require_permission() enforcement
│
└── docs/                       Specs and roadmap
```

### How frontend/backend communicate

The Next.js frontend calls `NEXT_PUBLIC_API_URL/api/v1/*` (defaults to `http://localhost:8000`). Every authenticated request sends `Authorization: Bearer <supabase_jwt>`. The typed `apiClient` in `src/lib/api/client.ts` wraps all fetch calls.

### Supabase integration structure

- **Frontend** (`src/lib/supabase/client.ts`) — uses `@supabase/ssr` with the anon key. Respects Row Level Security. Safe for the browser.
- **Backend** (`app/db/supabase.py`) — uses the service role key to perform trusted, permission-verified operations. The service role key **never leaves the backend**.

### Where AI services live

All AI code is isolated in `backend/app/ai/`:

| File | Role |
|---|---|
| `client.py` | Singleton `AsyncOpenAI` client |
| `inventory_assistant.py` | Natural language inventory Q&A (GPT-4.1) |
| `procurement_assistant.py` | Duplicate detection for purchase requests |
| `package_vision.py` | GPT-4o Vision — extracts metadata from package photos |
| `rag_assistant.py` | RAG Q&A grounded on KB documents + embeddings |

AI returns suggestions — humans confirm — backend applies. AI never writes to the database directly.

### RBAC foundation

Roles: `pi`, `researcher`, `student`. Extra per-user permissions allow Researchers to be elevated to "Operations Researcher" without a separate role.

- **Frontend** (`src/lib/rbac.ts`) — `hasPermission()` for visibility and conditional rendering.
- **Backend** (`app/middleware/rbac.py`) — `require_permission()` enforced per endpoint.

### How to run locally

**Frontend:**
```bash
cd frontend
cp .env.example .env.local   # add your Supabase + API URL
npm run dev                  # → http://localhost:3000
```

**Backend:**
```bash
cd backend
cp .env.example .env         # add your Supabase + OpenAI keys
uv run uvicorn app.main:app --reload --port 8000
# Health: http://localhost:8000/health
# Docs:   http://localhost:8000/docs
```

---

## Phase 2 — Auth, RBAC & Supabase Schema ✅

### What was built

End-to-end authentication with real JWT verification, role-based access control, and a seeded demo environment. No faked frontend-only auth — every protected backend endpoint verifies the token and checks permissions server-side.

### Database schema (`supabase/migrations/001_schema.sql`)

Seven tables:

| Table | Purpose |
|---|---|
| `organizations` | Top-level tenant (one per institution) |
| `labs` | A research group within an org |
| `profiles` | One row per Supabase auth user — stores `role`, `lab_id`, `org_id`, `full_name`, `is_active` |
| `permissions` | Lookup table of 10 named permissions |
| `user_permissions` | Per-user delegated extra permissions (Researcher → Operations Researcher) |
| `audit_logs` | Operational event log (who did what, when) |
| `ai_audit_logs` | AI interaction log (prompt, response, latency, tokens, status) |

All tables have Row Level Security enabled. Authenticated users can `SELECT` all rows in their lab. Only the backend service role writes.

`pgvector` extension is enabled for future RAG embeddings.

### Roles and permissions

Three roles: `pi`, `researcher`, `student`. No separate "Operations Researcher" role — it's a `researcher` with delegated permissions from `user_permissions`.

Base permissions per role:

| Permission | PI | Researcher | Student |
|---|---|---|---|
| `manage_users` | ✅ | | |
| `approve_purchase_request` | ✅ | | |
| `view_financial_summary` | ✅ | | |
| `assign_permissions` | ✅ | | |
| `manage_vendors` | ✅ | | |
| `upload_kb_docs` | ✅ | | |
| `manage_locations` | ✅ | | |
| `manage_categories` | ✅ | | |
| `assign_tasks` | ✅ | ✅ | |
| `manage_inventory` | ✅ | ✅ | |

### Demo users (`backend/scripts/seed_users.py`)

Run once after the schema migration:
```bash
cd backend
uv run python -m scripts.seed_users
```

| Email | Name | Role | Elevated permissions |
|---|---|---|---|
| `pi@demo.alma.lab` | Dr. Sarah Chen | PI | — |
| `researcher@demo.alma.lab` | Alex Rivera | Researcher | — |
| `ops@demo.alma.lab` | Jordan Kim | Researcher | `manage_locations`, `manage_vendors`, `upload_kb_docs`, `assign_permissions`, `manage_categories` |
| `student@demo.alma.lab` | Maya Patel | Student | — |

Password for all demo accounts: `demo1234`

### Backend auth (`backend/app/dependencies.py`)

`get_current_user` dependency:
1. Reads `Authorization: Bearer <jwt>` from the request
2. Validates the JWT via `supabase.auth.get_user(token)` (Supabase verifies signature + expiry)
3. Fetches the `profiles` row + any `user_permissions` rows for that user
4. Returns a typed `CurrentUser` with `id`, `email`, `role`, `lab_id`, `org_id`, `permissions[]`

`require_permission(permission)` returns a FastAPI dependency that calls `get_current_user` then asserts the user's role base permissions + delegated extras include the required permission. Returns `403` if not.

### Frontend auth flow

```
Browser                Middleware (server)         Dashboard Layout (server)
   |                         |                              |
   |── POST signInWithPassword ──▶ Supabase Auth            |
   |◀── session cookies ─────|                              |
   |── GET /dashboard ───────▶                              |
   |                    getUser() ──▶ Supabase              |
   |                    user found → NextResponse.next()    |
   |                         │──────────────────────────────▶
   |                         |                         getUser()
   |                         |                         SELECT profiles
   |                         |                         SELECT user_permissions
   |                         |                         ◀── profile + permissions
   |                         |                         render AppLayout with profile
   |◀── HTML (sidebar, topnav, page) ────────────────────────
```

Key files:

| File | Role |
|---|---|
| `frontend/src/middleware.ts` | Refreshes Supabase session on every request; redirects unauthenticated users to `/login` |
| `frontend/src/app/(auth)/login/page.tsx` | Demo role buttons + email/password form; on success: `router.push('/dashboard')` |
| `frontend/src/app/(dashboard)/layout.tsx` | Server component; fetches profile server-side; passes typed `UserProfile` to `AppLayout` |
| `frontend/src/components/layout/AppLayout.tsx` | Receives `profile` prop; wires sidebar + topnav |
| `frontend/src/components/layout/AppSidebar.tsx` | Filters nav items by role — students don't see Audit Logs or Settings |
| `frontend/src/components/layout/TopNav.tsx` | Shows real name, role badge, avatar initials, logout button |
| `frontend/src/components/auth/LogoutButton.tsx` | Calls `supabase.auth.signOut()` then `router.push('/login')` |

### Audit log service (`backend/app/services/audit_logs/service.py`)

Foundation only — no UI yet (Phase 8). Provides:
- `log_event()` — inserts into `audit_logs`
- `log_ai_interaction()` — inserts into `ai_audit_logs`
- `list_logs()` / `list_ai_logs()` — paginated fetch with `limit`/`offset`

Endpoints available at `GET /api/v1/audit-logs/` and `GET /api/v1/audit-logs/ai`.

### Security constraints enforced

- `SUPABASE_SERVICE_ROLE_KEY` is backend-only — never in `NEXT_PUBLIC_*` vars
- AI never writes to the database directly
- All permission checks happen server-side — frontend RBAC is for UI only

---

## Phase 3 — Inventory Management

---

## Phase 4 — Purchase Request Workflows

---

## Phase 5 — Package Intake + Vision AI

---

## Phase 6 — Knowledge Base + RAG

---

## Phase 7 — Dashboard + AI Copilot

---

## Phase 8 — Audit Logs + Settings
