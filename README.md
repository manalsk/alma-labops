# ALMA LabOps

**Operational Intelligence for Research Labs**

ALMA LabOps is a platform designed to help research labs reduce operational friction by centralizing inventory tracking, procurement workflows, task coordination, package intake, and institutional knowledge into a single AI-assisted operational workspace.

## Core Features

- Inventory management with low-stock detection
- Purchase request and approval workflows
- AI-assisted package intake using computer vision
- Role-based access control (PI, Researcher, Student)
- Knowledge base with AI-powered SOP retrieval
- Audit logging and operational traceability
- Embedded AI copilot for operational assistance

---

## Architecture

```
alma-labops/
├── frontend/        Next.js 16 + TypeScript + TailwindCSS v4 + shadcn/ui
├── backend/         FastAPI + Python 3.12 + uv
└── docs/            Product and UI specifications
```

### Frontend → Backend Communication

The Next.js frontend communicates with the FastAPI backend via REST (`/api/v1/*`). The backend URL is configured via `NEXT_PUBLIC_API_URL`. Authentication tokens from Supabase Auth are forwarded as `Authorization: Bearer <jwt>` headers.

### Supabase Integration

- **Frontend**: uses `@supabase/ssr` with the anon key — user-scoped, respects RLS.
- **Backend**: uses the service role key for trusted, permission-checked operations. The service role key is **never** exposed to the frontend.

### AI Services

All AI code lives in `backend/app/ai/`:

| Module | Purpose |
|---|---|
| `inventory_assistant.py` | Natural language inventory Q&A |
| `procurement_assistant.py` | Duplicate detection for purchase requests |
| `package_vision.py` | GPT-4o Vision metadata extraction from package images |
| `rag_assistant.py` | RAG Q&A grounded on knowledge base documents |

AI never mutates database state directly — it always returns structured suggestions that humans confirm before the backend applies them.

### RBAC

Roles: `pi`, `researcher`, `student`. Extra per-user permissions allow Researchers to be elevated to "Operations Researcher" without a separate role.

- **Frontend**: `src/lib/rbac.ts` — visibility and conditional rendering.
- **Backend**: `app/middleware/rbac.py` — `require_permission()` enforced per endpoint.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, TailwindCSS v4, shadcn/ui |
| Backend | FastAPI, Python 3.12, uv |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| AI | OpenAI SDK (GPT-4.1, GPT-4o, text-embedding-3-small) |
| Deployment | Vercel (frontend) + Render/Railway (backend) |

---

## Running Locally

### Frontend

```bash
cd frontend
cp .env.example .env.local   # fill in Supabase + API URL
npm install
npm run dev                  # http://localhost:3000
```

### Backend

```bash
cd backend
cp .env.example .env         # fill in Supabase + OpenAI keys
uv sync                      # install dependencies
uv run uvicorn app.main:app --reload --port 8000
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
# Health: http://localhost:8000/health
```

---

## Development Phases

- **Phase 1** (current): Architecture scaffold ✅
- **Phase 2**: Auth, RBAC, Supabase schema, seeded demo users
- **Phase 3**: Inventory management
- **Phase 4**: Purchase request workflows
- **Phase 5**: Package intake + Vision AI
- **Phase 6**: Knowledge Base + RAG
- **Phase 7**: Dashboard + AI copilot
- **Phase 8**: Audit logs + Settings
