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

## Phase 3 — Inventory Management ✅

### What was built

A full inventory management workflow — searchable table, detail drawer, CRUD operations, quantity tracking, low-stock alerting, role-aware actions, and a complete audit trail. All business logic enforced server-side; frontend RBAC only controls visibility.

### Database schema (`supabase/migrations/002_inventory.sql`)

Four new tables:

| Table | Purpose |
|---|---|
| `inventory_locations` | Named storage locations (e.g. "-80°C Freezer", "Dry Storage A") |
| `inventory_categories` | Item categories with optional color labels |
| `inventory_items` | Core inventory — quantity, unit, threshold, reorder qty, vendor, catalog # |
| `inventory_activity_logs` | Per-item change history with actor, action type, old/new values |

Status (`in_stock` / `low_stock` / `out_of_stock`) is computed at query time — never stored — based on `quantity` vs `threshold`.

### Demo seed data (`backend/scripts/seed_inventory.py`)

Run after the migration:
```bash
cd backend
uv run python -m scripts.seed_inventory
```

Seeds 6 locations, 6 categories, and 15 realistic lab items including:
- Items at full stock (Falcon tubes, PCR plates, gloves)
- Low-stock items (Pipette Tips 1000μL, Ethanol, Trypsin-EDTA, BSA Standard)
- Out-of-stock item (1.5mL Microcentrifuge Tubes)

### Backend API (`backend/app/api/v1/inventory/`)

| Method | Endpoint | Permission | Notes |
|---|---|---|---|
| `GET` | `/inventory/` | all roles | Returns all items with computed status + joined names |
| `POST` | `/inventory/` | `manage_inventory` | PI + Researcher |
| `GET` | `/inventory/locations` | all roles | |
| `GET` | `/inventory/categories` | all roles | |
| `GET` | `/inventory/{id}` | all roles | |
| `PATCH` | `/inventory/{id}` | `manage_inventory` | Updates metadata fields |
| `PATCH` | `/inventory/{id}/quantity` | `manage_inventory` | Dedicated quantity update with audit trail |
| `GET` | `/inventory/{id}/activity` | all roles | Last 20 activity entries |
| `DELETE` | `/inventory/{id}` | PI only | Enforced by role check, not just permission |

### Inventory service (`backend/app/services/inventory/service.py`)

Every mutation:
1. Performs the DB operation
2. Writes an `inventory_activity_logs` entry (actor, action, old/new values, notes)
3. Writes an `audit_logs` entry (for the global audit trail)

### Frontend architecture

**Profile context** — `UserProfileContext` wraps the app shell so any client component can call `useUserProfile()` without prop drilling. Set up in `AppLayout`.

**Data hook** — `useInventory()` fetches items, locations, and categories in parallel on mount. Exposes `createItem`, `updateItem`, `updateQuantity`, `deleteItem`, `fetchActivity` — each calls FastAPI with the Supabase JWT and refreshes state on success.

**Component tree:**
```
inventory/page.tsx         ← orchestrates all state + RBAC checks
  InventoryFilters         ← search + status/category/location dropdowns (client-side filtering)
  InventoryTable           ← row-per-item, amber left-border for low/out-of-stock
  InventoryDrawer          ← right Sheet with quantity bar, metadata, activity log
    StatusBadge            ← colored pill: In Stock / Low Stock / Out of Stock
  ItemFormDialog           ← create + edit form (quantity only shown on create)
  QuantityDialog           ← dedicated quantity update with notes field
```

### Role behavior

| Action | PI | Researcher | Student |
|---|---|---|---|
| View & search | ✅ | ✅ | ✅ |
| Add item | ✅ | ✅ | ✗ |
| Edit item metadata | ✅ | ✅ | ✗ |
| Update quantity | ✅ | ✅ | ✗ |
| Delete item | ✅ | ✗ | ✗ |

Students see the inventory table and drawer (read-only) but no action buttons are rendered.

### Low-stock UX

- Amber left-border accent on affected table rows
- Warning icon next to item name
- Alert banner at top of page with count + "Show only" toggle
- Quantity progress bar in the drawer (red / amber / green based on status)

---

## Phase 4 — Purchase Request & Procurement Workflows ✅

### What was built

A full enterprise procurement workflow with multi-item purchase requests, an approval pipeline, role-based access, inventory integration, activity timelines, and a live dashboard. All business logic enforced server-side; frontend RBAC only controls visibility.

### Database schema (`supabase/migrations/003_procurement.sql`)

Four new tables:

| Table | Purpose |
|---|---|
| `vendors` | Lab-scoped vendor directory (name, contact, website) |
| `purchase_requests` | Core request — title, status, urgency, requester, approver, estimated total, vendor |
| `purchase_request_items` | Line items per request — name, qty, unit, catalog #, estimated unit price |
| `procurement_activity_logs` | Per-request timeline (created, submitted, approved, rejected, etc.) |

Status flow: `draft → pending_approval → approved → ordered → received` (also `rejected`).

`estimated_total` is computed from items (qty × unit_price) and stored on the request row via a `_refresh_estimated_total()` helper called after any item change.

### Demo seed data (`backend/scripts/seed_procurement.py`)

Run after the migration:
```bash
cd backend
uv run python -m scripts.seed_procurement
```

Seeds 3 vendors and 6 realistic requests:
- Pipette Tips — pending approval (Alex Rivera)
- Ethanol — approved (Jordan Kim)
- Gloves — pending + clarification note (Jordan Kim)
- PCR Mix — ordered (Dr. Chen)
- Microscope Maintenance Contract — draft (Dr. Chen)
- BSA Standard — student suggestion (Maya Patel)

### Backend API (`backend/app/api/v1/purchase_requests/`)

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| `GET` | `/purchase-requests/vendors` | all roles | |
| `GET` | `/purchase-requests/` | all roles | Filter by status, urgency, requester_id, vendor_id |
| `POST` | `/purchase-requests/` | all roles | Students auto-submit as suggestions (`is_suggestion=True`) |
| `GET` | `/purchase-requests/{id}` | all roles | Includes items list |
| `PATCH` | `/purchase-requests/{id}` | PI or own draft/pending | |
| `DELETE` | `/purchase-requests/{id}` | PI or own draft | |
| `POST` | `/purchase-requests/{id}/submit` | own draft or PI | Draft → pending_approval |
| `POST` | `/purchase-requests/{id}/approve` | `approve_purchase_request` | PI only |
| `POST` | `/purchase-requests/{id}/reject` | `approve_purchase_request` | PI only |
| `POST` | `/purchase-requests/{id}/clarification` | `approve_purchase_request` | PI only |
| `POST` | `/purchase-requests/{id}/order` | `approve_purchase_request` | approved → ordered |
| `POST` | `/purchase-requests/{id}/receive` | PI or Researcher | ordered → received |
| `GET` | `/purchase-requests/{id}/activity` | all roles | Chronological timeline |

### Procurement service (`backend/app/services/purchase_requests/service.py`)

Every status transition:
1. Validates the actor's permission and the request's current state
2. Updates the `purchase_requests` row
3. Writes a `procurement_activity_logs` entry (actor, action, old/new status, notes)
4. Writes an `audit_logs` entry for the global audit trail

Item count is fetched efficiently using a single query on `purchase_request_items` with `in_("request_id", ids)` + Python Counter — no N+1 queries.

### Frontend architecture

**Data hook** — `useProcurement()` fetches requests and vendors in parallel on mount. Exposes all CRUD and workflow actions; each refreshes state on success.

**Component tree:**
```
purchase-requests/page.tsx     ← orchestrates all state + RBAC
  ProcurementFilters           ← search + status/urgency/vendor dropdowns
  ProcurementTable             ← row-per-request, violet "Suggestion" tag
    ProcurementStatusBadge     ← 6-status colored pill
    UrgencyBadge               ← low/normal/high/critical pill
  ProcurementDrawer            ← right Sheet with metadata, items, activity
  RequestFormDialog            ← multi-item create/edit; draft + submit buttons
  ApprovalActionDialog         ← approve/reject/clarify with notes field
```

**Dashboard** — `dashboard/page.tsx` (client component) shows:
- KPI cards: Pending Approvals, Low Stock Items, Orders In Transit, Inventory Items
- Action Queue: pending approvals (PI), reorder suggestions for low-stock items, own drafts
- Recent Requests: last 6 requests with status badge and requester

**Inventory integration** — Low/out-of-stock items in `InventoryDrawer` show an amber "Reorder" button that navigates to `/purchase-requests?action=new&item_name=…&unit=…`. The purchase-requests page reads these URL params on mount and pre-fills the new request form.

### Role behavior

| Action | PI | Researcher | Student |
|---|---|---|---|
| View all requests | ✅ | ✅ | ✅ (own only in practice) |
| Create request | ✅ | ✅ | ✅ (auto-submitted as suggestion) |
| Save as draft | ✅ | ✅ | ✗ |
| Submit for approval | ✅ | ✅ (own draft) | auto on create |
| Edit pending request | ✅ | ✅ (own) | ✗ |
| Approve / Reject / Clarify | ✅ | ✗ | ✗ |
| Mark as Ordered | ✅ | ✗ | ✗ |
| Mark as Received | ✅ | ✅ | ✗ |
| Delete | ✅ | own draft only | ✗ |
| View estimated totals | ✅ | ✗ | ✗ |

---

## Phase 5 — Tasks + Package Intake + Vision AI ✅

### Phase 5A — Task Management

A full Kanban task board with role-aware CRUD, status transitions, priority tracking, overdue detection, assignee management, and activity timelines.

#### Database schema (`supabase/migrations/004_tasks.sql`)

Two new tables:

| Table | Purpose |
|---|---|
| `tasks` | Core task — title, description, status, priority, type, assignee, due date, related package id |
| `task_activity_logs` | Per-task timeline (created, status changes, assignments, etc.) |

Statuses: `todo → in_progress → blocked → completed`. Priorities: `low`, `normal`, `high`, `urgent`.

#### Demo seed data (`backend/scripts/seed_tasks.py`)

```bash
cd backend
uv run python -m scripts.seed_tasks
```

Seeds 5 realistic tasks: unpack reagents (in_progress), organize freezer (todo), verify pipettes (todo/student), upload SOP (completed), label cabinet (blocked/overdue).

#### Backend API (`backend/app/api/v1/tasks/`)

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| `GET` | `/tasks/` | all roles | Filter by status, priority, assigned_to |
| `POST` | `/tasks/` | `assign_tasks` (PI + Researcher) | |
| `GET` | `/tasks/{id}` | all roles | |
| `PATCH` | `/tasks/{id}` | PI + Researcher | Full metadata update |
| `DELETE` | `/tasks/{id}` | PI only | |
| `PATCH` | `/tasks/{id}/status` | PI + Researcher, or own assigned task | Students can only update their own |
| `GET` | `/tasks/{id}/activity` | all roles | |
| `GET` | `/auth/members` | all roles | Returns `id, full_name, role` for lab members |

#### Frontend architecture

**Data hook** — `useTasks()` fetches tasks and lab members in parallel. Exposes `createTask`, `updateTask`, `updateStatus`, `deleteTask`, `fetchActivity`.

**Component tree:**
```
tasks/page.tsx             ← Kanban orchestrator, filters, overdue banner
  TaskFilters              ← search + priority/type/assignee dropdowns
  TaskKanban               ← 4 columns (Todo / In Progress / Blocked / Completed)
    TaskCard               ← priority left-border accent, overdue date in red
  TaskDrawer               ← right Sheet with status action buttons, activity log
  TaskFormDialog           ← create/edit with priority, type, assignee, due date
```

**Dashboard additions:**
- 3rd KPI card → "Open Tasks" (amber `urgent` flag when any task is overdue)
- Action Queue: "Overdue Tasks" section (top priority) + "My Tasks" section

#### Role behavior

| Action | PI | Researcher | Student |
|---|---|---|---|
| View all tasks | ✅ | ✅ | ✅ |
| Create task | ✅ | ✅ | ✗ |
| Edit task | ✅ | ✅ | ✗ |
| Update own task status | ✅ | ✅ | ✅ (own assigned only) |
| Delete task | ✅ | ✗ | ✗ |

---

### Phase 5B — Incoming Package Intake + Vision AI

The MVP signature feature. Upload a package photo, run GPT-4o Vision to extract metadata, review and confirm as a human, then create an inventory item or unpacking task — all in one drawer workflow.

**Demo stability design:** Seeded packages use deterministic mocked extraction (no API calls, instant results). Real OpenAI Vision is available behind an explicit "Live AI" button so demo environments never break on missing keys or rate limits.

#### Database schema (`supabase/migrations/005_incoming_packages.sql`)

Two new tables + extended ai_audit_logs:

| Table | Purpose |
|---|---|
| `incoming_packages` | Core intake record — image URL/path, all `extracted_*` fields, extraction status/mode/confidence, review status, linked inventory/task IDs |
| `package_activity_logs` | Per-package timeline (uploaded, extracted, verified, rejected, inventory created, etc.) |

`ai_audit_logs` extended with: `metadata jsonb`, `package_id uuid`, `tokens_used integer`.

Enums: `package_review_status` (`pending`, `verified`, `rejected`, `manual_review`), `extraction_mode` (`mocked`, `live_ai`).

#### Demo seed data (`backend/scripts/seed_packages.py`)

```bash
cd backend
uv run python -m scripts.seed_packages
```

Seeds 5 packages with real demo images uploaded to Supabase Storage (`package-images/demo/`):

| Package | Review Status | Extraction |
|---|---|---|
| Pipette Tips 1000μL | verified | mocked |
| Ethanol 200 Proof | pending | mocked |
| Conical Tubes 15mL | pending | mocked |
| Anti-GFP Antibody | verified + processed | mocked |
| Nitrile Gloves | pending | mocked |

#### AI layer (`backend/app/ai/package_vision.py`)

- **Mock extraction** — `mock_extract(image_url)`: URL-pattern keyed dict; deterministic, zero cost, used for all seeded packages.
- **Live extraction** — `async live_extract(image_url)`: calls GPT-4o with `"detail": "low"` and a structured JSON prompt. Returns raw dict + `tokens_used`. Max 400 tokens per call.
- OpenAI API key comes from `backend/.env` only — never exposed to the frontend.

#### Backend API (`backend/app/api/v1/incoming_packages/`)

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| `GET` | `/incoming-packages/` | all roles | |
| `POST` | `/incoming-packages/` | all roles | Multipart `UploadFile`; stores image in Supabase Storage; returns 1-year signed URL |
| `GET` | `/incoming-packages/{id}` | all roles | |
| `POST` | `/incoming-packages/{id}/extract` | all roles | `?mode=mocked` (default) or `?mode=live`; logs to `ai_audit_logs` with tokens + confidence |
| `POST` | `/incoming-packages/{id}/verify` | PI + Researcher | Accepts editable field overrides |
| `POST` | `/incoming-packages/{id}/reject` | PI + Researcher | |
| `POST` | `/incoming-packages/{id}/create-inventory` | `manage_inventory` | Blocked if already linked; prefills from extracted fields |
| `POST` | `/incoming-packages/{id}/create-task` | `assign_tasks` | Creates task with `task_type=package_intake`; blocked if already linked |
| `POST` | `/incoming-packages/{id}/process` | PI + Researcher | Sets `processed_at` |
| `GET` | `/incoming-packages/{id}/activity` | all roles | |

#### Frontend architecture

**API client addition** — `apiClient.postFile()` uses `isMultipart: true` flag to skip `Content-Type: application/json` so the browser sets the multipart boundary automatically.

**Data hook** — `usePackages()` exposes: `uploadPackage`, `runExtraction`, `verifyExtraction`, `rejectExtraction`, `createInventory`, `createTask`, `markProcessed`, `fetchActivity`. Each method refreshes state and returns the updated package so the drawer stays in sync.

**Component tree:**
```
incoming-packages/page.tsx     ← orchestrates all state + RBAC
  PackageFilters               ← search + review_status + extraction_status dropdowns
  PackageTable                 ← thumbnail, item name, uploader, badges, timeAgo
    PackageReviewBadge         ← pending/verified/rejected/manual_review
    ExtractionStatusBadge      ← pending/processing/completed/failed
    ExtractionModeBadge        ← mocked (violet) / live_ai (teal)
    ConfidenceBadge            ← high/medium/low confidence pill
  PackageDrawer                ← 560px Sheet; activePanel state machine
    null panel                 ← image preview + extraction summary
    'review' panel             ← editable fields for all 7 extracted metadata fields
    'inventory' panel          ← threshold / reorder_qty / notes form
    'task' panel               ← title + assignee + priority + due date form
  PackageUploadDialog          ← drag/drop + file browser; type+size validation; preview
```

**PackageDrawer footer button logic:**
- "Run Extraction" (mocked) + "Live AI" → visible when extraction_status is `pending` or `failed`
- "Verify Extraction" → visible when `completed` and not yet `verified`
- "Add to Inventory" / "Create Task" → visible when `verified`, not yet processed, and not already linked
- "Mark as Processed" → visible when both actions are done (or skipped)

**Dashboard addition:**
- 4th KPI card → "Incoming Packages" (count of packages with `review_status=pending` and `extraction_status=completed`; amber `urgent` flag when non-zero)

#### Role behavior

| Action | PI | Researcher | Student |
|---|---|---|---|
| Upload package image | ✅ | ✅ | ✅ |
| Run extraction (mocked or live) | ✅ | ✅ | ✅ |
| Verify / reject extraction | ✅ | ✅ | ✗ |
| Create inventory from package | ✅ | ✅ (if `manage_inventory`) | ✗ |
| Create task from package | ✅ | ✅ | ✗ |
| Mark as processed | ✅ | ✅ | ✗ |

#### Security constraints

- `OPENAI_API_KEY` is in `backend/.env` only — never in any `NEXT_PUBLIC_*` variable
- All OpenAI Vision calls happen on the backend only (`backend/app/ai/`)
- `SUPABASE_SERVICE_ROLE_KEY` is backend-only — all Storage uploads go through the backend service
- AI never creates inventory items or tasks autonomously — human confirmation required every time
- Extraction is never triggered automatically on upload

---

## Phase 6 — Knowledge Base + RAG

---

## Phase 7 — Dashboard + AI Copilot

---

## Phase 8 — Audit Logs + Settings
