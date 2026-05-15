# ALMA LabOps — Key Design Decisions

This document explains the reasoning behind the major architectural and technical choices made in ALMA LabOps. Each decision reflects a deliberate tradeoff between speed, safety, maintainability, and the realities of an early-stage operational MVP.

---

## 1. Technology Stack Choices

### FastAPI over Django or Flask

FastAPI was chosen for its native async support, automatic OpenAPI documentation, and Pydantic-native request/response validation. For an application where API correctness matters — wrong permission checks, malformed inventory updates — having schema validation as a first-class framework feature reduces an entire category of bugs. Django REST Framework is significantly more opinionated and carries more setup overhead for a greenfield project. Flask requires manually adding most of what FastAPI provides out of the box.

### Pydantic for all data models

Every API boundary — request bodies, response shapes, the `CurrentUser` object, configuration — is typed with Pydantic. This makes the implicit explicit: what fields an endpoint expects, what it guarantees to return, and what the backend considers a "valid" user. In an operational system that manages inventory, purchase approvals, and AI outputs, this matters more than in a typical CRUD app. A permission check that silently accepts the wrong field type is a latent bug.

### Supabase over a self-managed database

Supabase was selected because it eliminates significant infrastructure overhead without sacrificing control. It provides PostgreSQL (a mature, well-understood relational database), Supabase Auth (JWT-based, integrates cleanly with the backend's `get_current_user` dependency), Supabase Storage (private buckets with signed URLs), and pgvector (for KB embeddings) — all from a single service. For an MVP with a small team, managing separate services for auth, storage, and a vector database would have added meaningful operational complexity with no proportional benefit.

Row Level Security is enabled on all tables as a defense-in-depth measure. The application enforces permissions at the API layer; RLS provides a secondary boundary for any direct database access.

### pgvector over a dedicated vector database (Pinecone, Weaviate, Qdrant)

The KB document corpus for a single research lab is small. At the scale this MVP targets — tens to low hundreds of documents, thousands of chunks — a pgvector IVFFlat index on a Supabase-hosted PostgreSQL instance performs adequately and keeps the infrastructure footprint minimal. Introducing a dedicated vector database would require a separate service, separate API keys, separate failure modes, and a synchronization mechanism to keep it in sync with the document metadata in PostgreSQL. The operational cost of that complexity outweighs any retrieval performance gain at this scale.

### Next.js 16 (App Router)

Next.js was chosen for its strong TypeScript integration, file-based routing, server components (used for the layout/auth check), and ecosystem maturity. The App Router enables the dashboard layout to fetch the user profile server-side before rendering, which avoids a flash of unauthenticated UI and simplifies the auth flow. The client component boundary is used deliberately: pages that need live data (inventory, tasks) are client components with data hooks; the layout shell is a server component.

### TailwindCSS v4 + shadcn/ui

TailwindCSS provides utility-first styling that scales without growing a large, unmaintainable CSS codebase. For an operational interface that needs tables, badges, drawers, and forms — not marketing pages or animation-heavy UIs — Tailwind's density of expression is a good fit. shadcn/ui provides unstyled-but-accessible component primitives (dialogs, sheets, tooltips) that integrate naturally with Tailwind without imposing a design system that has to be overridden everywhere.

---

## 2. AI Architecture Decisions

### Backend-only AI calls

The OpenAI API key lives in `backend/.env` and is never referenced in any frontend environment variable. All AI calls originate from the backend; the frontend submits a question or triggers an action via a normal authenticated REST endpoint. This is not just a security measure — it also means AI interactions can be logged server-side with full context (user ID, role, prompt, model, tokens, status) before the response reaches the browser. Putting AI calls in the browser would make them unloggable, unauditable, and would expose usage to any user who inspected network traffic.

### Constrained prompts over general-purpose AI

Both the RAG assistant and the operational copilot use strict multi-rule system prompts that explicitly restrict what the model is permitted to do. The RAG assistant must answer only from retrieved chunks. The copilot must answer only from the context sections provided. Both refuse off-topic questions with a fixed phrase. Both include injection guards.

This is intentional. A general-purpose AI assistant that can answer anything — drawing on its training data, extrapolating beyond the provided context, or executing multi-step reasoning across multiple domains — introduces unpredictability into an operational workflow. For a laboratory operations platform, an incorrect answer about stock levels, procurement status, or SOP procedures has real consequences. Constrained prompts significantly reduce the surface area for hallucination, prompt injection, and out-of-scope behavior.

### Human-in-the-loop for all AI-generated operational data

No AI output in ALMA LabOps is applied to the database automatically. Package extraction results are drafts — a user must click "Verify Extraction" before anything is confirmed. Inventory creation from a verified package requires an explicit "Add to Inventory" action. The copilot explicitly cannot approve, reject, create, or modify records — it can only inform.

This reflects the core design principle from the spec: AI is assistive, not autonomous. The lab team makes operational decisions; the AI reduces the information-gathering friction around those decisions.

### Mocked extraction by default

Vision extraction uses a deterministic mock by default (`?mode=mocked`). The mock returns realistic, pre-keyed results based on the image URL pattern — no API call, instant response, zero token cost. Live AI extraction is available behind an explicit button.

This decision was driven by two concerns. First, demo stability: a demo environment that requires a valid OpenAI key and live API calls is fragile. Rate limits, key expiry, or network issues would break the demo at the worst possible moment. Second, cost predictability: extraction at demo scale is fine, but building a habit of triggering live AI calls for every seeded package adds unnecessary cost during development and testing. The mocked mode also makes it easier to run the seed scripts in CI or offline environments.

### No proactive AI-generated dashboard summaries

The dashboard shows deterministic KPI cards (counts from the database) and a role-filtered action queue. There is no AI-generated "daily summary" or narrative description of the lab's state, despite this being a natural feature for an AI-assisted platform.

This was a deliberate choice for two reasons. First, generating a dashboard summary on every page load would make an OpenAI call every time any user opens the app — a meaningful and poorly-bounded token cost with no clear ROI at MVP stage. Second, there is no real production data yet. An AI summary generated from 15 seeded inventory items and 6 seeded tasks would be meaningless at best and misleading at worst. Deterministic metrics — "3 items low stock, 2 requests pending" — are more trustworthy and cheaper to produce. AI-generated summaries are a feature worth revisiting when there is real operational data to summarize and a clear user need has been validated.

### No LangChain, LangSmith, or agentic orchestration frameworks

ALMA LabOps calls the OpenAI API directly via the official `openai` Python SDK. It does not use LangChain, LangGraph, LangSmith, AutoGen, CrewAI, or any multi-agent orchestration framework.

The reasoning is simple: the AI workflows in this application are straightforward enough that an orchestration framework would add complexity without adding capability.

- Vision extraction: one API call, structured JSON output.
- RAG: one embedding call + one retrieval call + one completion call.
- Copilot: one completion call with assembled context.

All three fit comfortably in a single async function. There are no conditional multi-step chains, no tool-calling loops, no agent decision graphs. Introducing an orchestration framework for these workflows would mean learning its abstractions, debugging its behavior when things go wrong, and carrying its dependencies — for no functional benefit over direct SDK calls.

LangSmith specifically was considered for eval tracing and observability. It was not adopted because the current eval needs are simple enough to address with a lightweight JSON-based eval runner (`run_basic_ai_evals.py`) and basic logging. LangSmith makes sense when prompt iteration is happening at scale with production traffic. At MVP stage with a small eval suite and no production deployment, the overhead of integrating and maintaining it is not justified.

These decisions may be revisited when the AI workflows genuinely require orchestration, multi-step reasoning, or production-scale observability tooling.

### gpt-4.1-mini for all text generation

All text completion tasks (RAG assistant, copilot, vision extraction) use `gpt-4.1-mini`. Embeddings use `text-embedding-3-small`. Neither is the largest or most capable model in its class, but both are appropriate for the task complexity, significantly cheaper than their larger counterparts, and fast enough for synchronous API calls in a web UI. Using the largest available model by default is a cost and latency decision that should be justified by the task requirements — for constrained operational Q&A over structured context, the mini model performs well.

---

## 3. Operational Workflow Decisions

### Deterministic workflows for core operations

Inventory CRUD, purchase request status transitions, task management, and package review are all implemented as explicit, deterministic backend operations with validation. The status flow for a purchase request (`draft → pending_approval → approved → ordered → received`) is enforced in code, not inferred by AI. A researcher cannot skip a step by phrasing a request cleverly.

This is the right approach for operational software. The reliability of a lab's procurement workflow should not depend on the consistency of an AI model's output. AI is used to surface information and reduce friction at the edges of these workflows (e.g. the copilot surfacing which requests are pending), not to own the workflow logic itself.

### Role-based delegation without role proliferation

The system has three roles: `pi`, `researcher`, `student`. Rather than introducing additional roles (e.g. "operations manager", "lab admin") to represent intermediate access levels, the architecture uses a `user_permissions` table to delegate specific capabilities to individual users. A researcher can be granted `manage_locations`, `upload_kb_docs`, or `view_audit_logs` without changing their role.

This keeps the role model simple and auditable. Adding a new role would require updating frontend RBAC logic, backend permission tables, seeding, and documentation everywhere. Delegating a permission requires inserting one row and is reversible by the PI in the Settings interface.

### Audit logging as a first-class concern

Every significant operational event writes to `audit_logs` (create/update/delete on inventory, tasks, packages, procurement). Every AI interaction writes to `ai_audit_logs`. This is not optional tracing — it is a core part of the service layer's contract. Services are written so that business logic and audit logging happen in the same transaction path.

For a laboratory operations context — where compliance, reproducibility, and accountability matter — traceability is a functional requirement, not a nice-to-have.

---

## 4. Decisions Deliberately Out of Scope

The following were evaluated and explicitly excluded from the MVP:

**Autonomous workflows** — no automatic reorder trigger, no autonomous procurement approval, no self-healing inventory. All actions require human initiation.

**Real-time sync (WebSockets)** — the frontend uses polling-on-mount, not WebSocket subscriptions. Real-time collaboration and live notifications were out of scope for an operational MVP with a small team.

**Enterprise SSO** — the login page shows a disabled "Continue with Organization Email (Coming Soon)" button to communicate future intent. Supabase supports SSO providers; the architecture does not obstruct this, but implementing it was not in scope.

**Notifications and alerting** — low-stock alerts, overdue task reminders, and procurement status changes are visible on the dashboard and in audit logs, but there is no email/Slack notification system.

**Analytics and reporting** — there are no trend charts, usage graphs, or exportable reports. The dashboard shows current operational state, not historical analysis. A reporting layer requires real production data to be meaningful.

**Barcode scanning and RFID** — package intake uses computer vision on uploaded photos. Physical scanning infrastructure was out of scope.

**Multi-organization support** — the schema supports organizations and labs, but the UI and seeding are single-lab focused. Multi-tenancy isolation is in the data model but not the product surface.
