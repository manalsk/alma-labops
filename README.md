# ALMA LabOps

**Operational Intelligence for Research Labs**

ALMA LabOps is a platform designed to help research labs reduce operational friction by centralizing inventory tracking, procurement workflows, task coordination, package intake, and institutional knowledge into a single AI-assisted operational workspace.

## Core Features

- Inventory management with low-stock detection and audit trail
- Purchase request and approval workflows
- AI-assisted package intake using computer vision (GPT-4o Vision)
- Role-based access control (PI, Researcher, Student) with delegatable permissions
- Knowledge base with AI-powered SOP retrieval (RAG)
- Operational AI copilot grounded in live lab data
- Dual audit log viewer (operational events + AI interactions)
- Modular settings with PI-controlled permission delegation
- Lightweight AI eval suite for both RAG and Copilot

---

## Architecture

```
alma-labops/
├── frontend/        Next.js 16 + TypeScript + TailwindCSS v4 + shadcn/ui
├── backend/         FastAPI + Python 3.12 + uv
├── evals/           Manual AI eval cases (JSON)
└── docs/            Product specs and implementation roadmap
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
| `package_vision.py` | GPT-4o Vision — extracts metadata from package photos |
| `rag_assistant.py` | RAG Q&A grounded exclusively on approved KB documents |
| `copilot.py` | Operational Q&A grounded in live lab data (inventory, tasks, procurement) |

Security constraints enforced across all AI modules:
- `OPENAI_API_KEY` stored in `backend/.env` only — never in any `NEXT_PUBLIC_*` variable
- All OpenAI calls happen on the backend only
- AI never writes to the database — suggestions require human confirmation
- OpenAI calls are only triggered by explicit user action (submit button / suggested prompt)

### RBAC

Three roles: `pi`, `researcher`, `student`. Extra per-user permissions allow researchers to be granted elevated access without a separate role.

- **Frontend**: `src/lib/rbac.ts` — `hasPermission()` for visibility and conditional rendering.
- **Backend**: `app/middleware/rbac.py` — `require_permission()` enforced per endpoint.

Delegatable permissions (PI can grant to researchers via Settings → Team):

| Permission | Description |
|---|---|
| `view_audit_logs` | Read access to operational and AI audit logs |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, TailwindCSS v4, shadcn/ui |
| Backend | FastAPI, Python 3.12, uv |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage |
| AI | OpenAI SDK (GPT-4.1-mini, GPT-4o Vision, text-embedding-3-small) |
| Deployment | Vercel (frontend) + Render (backend) |

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

### Database migrations

Apply migrations in order via the Supabase SQL Editor:

```
supabase/migrations/001_schema.sql
supabase/migrations/002_inventory.sql
supabase/migrations/003_procurement.sql
supabase/migrations/004_tasks.sql
supabase/migrations/005_incoming_packages.sql
supabase/migrations/006_knowledge_base.sql
supabase/migrations/007_copilot.sql
supabase/migrations/008_permissions_catalog.sql
```

### Seed demo data

Run each seed script once after migrations:

```bash
cd backend
uv run python -m scripts.seed_users
uv run python -m scripts.seed_inventory
uv run python -m scripts.seed_procurement
uv run python -m scripts.seed_tasks
uv run python -m scripts.seed_packages
uv run python -m scripts.seed_knowledge_base
```

Demo accounts (password: `demo1234`):

| Email | Name | Role |
|---|---|---|
| `pi@demo.alma.lab` | Dr. Sarah Chen | PI |
| `researcher@demo.alma.lab` | Alex Rivera | Researcher |
| `ops@demo.alma.lab` | Jordan Kim | Researcher (elevated) |
| `student@demo.alma.lab` | Maya Patel | Student |

---

## AI Evals

A lightweight manual eval suite lives in `evals/basic_ai_eval_cases.json` (15 cases across RAG and Copilot). Run it with:

```bash
cd backend

uv run python -m scripts.run_basic_ai_evals           # all cases
uv run python -m scripts.run_basic_ai_evals --system rag
uv run python -m scripts.run_basic_ai_evals --system copilot
uv run python -m scripts.run_basic_ai_evals --id cop_04
```

Requires `OPENAI_API_KEY` in `backend/.env`. Exit code 1 on any failure.

---

## Hosted Demo / Deployment

### Frontend (Vercel)

[https://alma-labops.vercel.app/login](https://alma-labops.vercel.app/login)

### Backend API (Render)

[https://alma-labops.onrender.com/health](https://alma-labops.onrender.com/health)

---

## Deployment Architecture

ALMA LabOps is deployed using:

- Vercel (Next.js frontend)
- Render (FastAPI backend)
- Supabase (database, authentication, storage, pgvector)

This stack was selected for the MVP phase for rapid iteration, low operational overhead, and managed infrastructure. It is suitable for MVP testing, academic demonstrations, and small-scale laboratory pilots.

---

## Future Enterprise Deployment Considerations

The platform architecture is intentionally modular and portable. If required by institutional IT policy, the system could be migrated to enterprise infrastructure such as Microsoft Azure, AWS, or a private cloud.

---

## Important Notes for Testers

- The Render backend runs on the free tier and may take 30–60 seconds to wake after inactivity.
- AI-assisted features use OpenAI API credits. Please use AI-powered actions conservatively during testing.

    AI-powered features: Vision AI package extraction, Knowledge Base assistant, Operational AI copilot, and AI evaluation scripts.

    The platform uses constrained, human-supervised AI workflows focused on operational laboratory use cases.

## Demo Video

[Google Drive — Demo Walkthrough](https://drive.google.com/file/d/1SHe1bPswaNMbcMZKSGPnd3OMI8VafA2a/view?usp=sharing)
