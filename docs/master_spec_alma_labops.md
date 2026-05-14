# MASTER_SPEC.md
# ALMA LabOps — MVP Engineering Specification

## Operational Intelligence for Research Labs

---

# 1. Product Overview

ALMA LabOps is an AI-assisted laboratory operations platform designed to help research laboratories manage operational workflows without requiring a dedicated lab manager.

The platform centralizes:

- inventory management
- procurement workflows
- task coordination
- package intake
- onboarding and SOP retrieval
- operational communication
- auditability and traceability

The system is designed as:

```text
Operational software with embedded AI copilots
```

NOT:

```text
Autonomous AI agents managing the laboratory
```

AI is used to:

- reduce operational friction
- interpret natural language
- extract structured information
- summarize operational workflows
- assist onboarding
- improve operational visibility
- accelerate repetitive administrative tasks

All business-critical workflows remain deterministic and backend-controlled.

---

# 2. Product Vision

ALMA LabOps aims to become:

```text
Operational Intelligence Infrastructure for Research Laboratories
```

The platform is intended to evolve into a scalable operational layer for:

- university research labs
- biotech laboratories
- translational medicine labs
- molecular biology labs
- startup R&D laboratories

The MVP focuses on proving:

- operational clarity
- AI-assisted workflows
- traceability
- scalable architecture

---

# 3. MVP Goals

The MVP should demonstrate:

```text
A production-style AI-native laboratory operations platform
```

The MVP prioritizes:

- inventory workflows
- procurement workflows
- role-based access control
- operational traceability
- AI-assisted package intake
- onboarding assistance
- operational search and retrieval

The MVP is optimized for:

- capstone presentation
- client demonstration
- fast implementation
- future scalability

---

# 4. Core Technology Stack

## Frontend

```text
Next.js
TypeScript
TailwindCSS
shadcn/ui
```

## Backend

```text
FastAPI
Python 3.12
uv package manager
```

## Database / Infrastructure

```text
Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- pgvector
```

## AI Layer

```text
OpenAI SDK
GPT-4.1
GPT-4o
GPT-4o Vision
```

Use:

- structured outputs
- tool calling
- embeddings
- retrieval-augmented generation (RAG)

## Deployment

```text
Frontend → Vercel
Backend → Render or Railway
Database/Auth/Storage → Supabase
```

---

# 5. Core Architectural Principles

## 5.1 AI does NOT own business logic

Correct architecture:

```text
User
 ↓
AI Assistant
 ↓
Backend Tool/API
 ↓
Business Logic Layer
 ↓
Database
```

AI responsibilities:

- interpret requests
- summarize information
- extract metadata
- retrieve contextual information
- assist workflows

Backend responsibilities:

- validate permissions
- enforce workflows
- update state
- protect business rules
- create audit logs

## 5.2 AI never directly accesses database

All database operations must happen through:

- backend services
- permission-aware APIs

AI may request actions but cannot mutate database state directly.

## 5.3 Human confirmation required

AI-generated operational actions remain drafts until confirmed by users.

Examples:

- package extraction
- inventory creation
- purchase requests

## 5.4 Role-based authorization required

Authorization must be enforced:

- in frontend UI
- AND backend APIs

## 5.5 Operational traceability is mandatory

All important operational events should generate:

- audit logs
- actor attribution
- timestamps
- AI interaction traces where applicable

---

# 6. User Roles & Permission Model

## Base Roles

```text
PI
Researcher
Student
```

## Permission-Based Expansion

Capabilities are controlled through permissions.

Example permissions:

```text
manage_users
manage_vendors
upload_kb_docs
assign_tasks
approve_purchase_request
view_financial_summary
manage_locations
manage_inventory
```

## Delegated Operational Permissions

Researchers may receive operational/admin-like responsibilities without becoming full administrators.

## AI Permission Inheritance

The AI assistant inherits the permissions of the currently authenticated user.

AI must not bypass authorization boundaries.

---

# 7. Authentication & Authorization

## MVP Authentication Strategy

Use:

```text
Supabase email/password auth
```

with:

```text
seeded demo users
```

Example demo users:

```text
PI
Researcher
Operations Researcher
Student
```

## Future Production Authentication

The production architecture should support:

```text
Microsoft SSO
Google Workspace SSO
Organization email login
```

The system should use:

```text
Invitation-based onboarding
```

NOT:

```text
self-assigned roles
```

---

# 8. Supabase Architecture

## Required Services

Enable:

```text
Supabase Auth
Supabase Storage
pgvector extension
```

## Storage Buckets

### package-images

Purpose:

- incoming package images
- package intake workflow

Recommended:

```text
Private bucket
10 MB limit
```

Allowed MIME types:

```text
image/png
image/jpeg
image/webp
```

### kb-documents

Purpose:

- SOPs
- onboarding documents
- policies
- operational knowledge

Recommended:

```text
Private bucket
50 MB limit
```

Allowed MIME types:

```text
application/pdf
text/plain
text/markdown
application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

## Environment Variables

Required environment variables:

```env
OPENAI_API_KEY=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Important:

- SUPABASE_SERVICE_ROLE_KEY must remain backend-only.
- NEXT_PUBLIC_* variables are frontend-safe.

---

# 9. Core MVP Workflows

## Inventory Workflow

```text
Item arrives
 ↓
Inventory item created
 ↓
Location assigned
 ↓
Users consume item
 ↓
Quantity updated
 ↓
Low stock detected
 ↓
Reorder workflow triggered
```

## Purchase Request Workflow

```text
Researcher creates request
 ↓
AI checks duplicates/inventory
 ↓
PI approval queue
 ↓
Approved/rejected
 ↓
Inventory updated
```

## Task Workflow

```text
Task created
 ↓
Assigned
 ↓
In progress
 ↓
Completed
 ↓
Audit logged
```

## Package Intake Workflow

```text
Upload package image
 ↓
AI extracts metadata
 ↓
Human reviews extraction
 ↓
Create:
- inventory draft
- unpacking task
```

## Knowledge Base Workflow

```text
Upload SOP/document
 ↓
Chunk document
 ↓
Generate embeddings
 ↓
Store in pgvector
 ↓
Semantic retrieval
 ↓
Grounded AI response
```

---

# 10. Database Schema

## Core Tables

```text
organizations
labs
users
permissions
user_permissions
inventory_locations
inventory_items
purchase_requests
tasks
incoming_packages
kb_documents
document_chunks
audit_logs
ai_audit_logs
```

## Important AI Audit Fields

```text
user_id
role
prompt
tool_called
model_used
response_summary
status
created_at
```

---

# 11. AI Features

## Inventory Assistant

Examples:

```text
Do we have pipette tips?
Where is ethanol stored?
What items are low stock?
```

## Procurement Assistant

Examples:

```text
Create request for gloves
Check for duplicate requests
```

## SOP / RAG Assistant

Examples:

```text
How do I dispose biohazard waste?
How do I request a reagent?
```

## Package Intake Vision AI

Extract:

- item name
- vendor
- quantity
- catalog number
- category

---

# 12. AI Safety Constraints

AI MUST NOT:

- approve purchases autonomously
- bypass permissions
- directly mutate database state
- invent unsupported SOPs
- impersonate operational authority
- perform destructive actions without confirmation

---

# 13. Pages / Routes

```text
/login
/dashboard
/inventory
/purchase-requests
/tasks
/incoming-packages
/knowledge-base
/audit-logs
/settings
```

---

# 14. Audit Logging

All important operational events should generate audit entries.

## AI Audit Logging

All AI interactions should log:

```text
prompt
tool_calls
model
user
timestamp
status
```

---

# 15. Development Workflow Recommendations

## Recommended Development Stack

```text
Claude Code + VS Code
```

Use:

- phase-by-phase prompting
- aggressive Git commits
- spec-driven development

## Recommended Git Strategy

Commit after major features.

Examples:

```text
feat: initial architecture scaffold
feat: auth and RBAC
feat: inventory management
feat: procurement workflow
feat: package intake AI
feat: RAG assistant
```

---

# 16. Explicitly Out of Scope

DO NOT build:

```text
notifications
billing
multi-org switching
advanced analytics
barcode scanning
websocket realtime sync
autonomous AI agents
complex task hierarchies
advanced vendor optimization
grant accounting
```

---

# 17. Core MVP Philosophy

The MVP should optimize for:

```text
Operational clarity
Believable AI assistance
Workflow realism
Traceability
Production-style architecture
```

NOT:

```text
maximum AI complexity
```

