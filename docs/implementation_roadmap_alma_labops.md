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

## Phase 2 — Auth, RBAC & Supabase Schema

*Coming next*

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
