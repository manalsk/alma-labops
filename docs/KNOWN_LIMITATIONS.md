# ALMA LabOps — Known Limitations

This document is an honest assessment of the current state of ALMA LabOps. It is intended for reviewers, clients, and future engineers who need to understand what the platform does and does not do today, and why certain decisions were made conservatively.

---

## 1. AI Capabilities Have Not Been Validated Against Real Operational Data

This is the most important limitation to state clearly.

All AI features in ALMA LabOps — vision extraction, RAG retrieval, and the operational copilot — were designed, implemented, and tested against seeded demo data in a controlled environment. They have not been validated against:

- Real laboratory package diversity (varying label formats, image quality, languages, handwriting)
- Real SOP documents from an actual institution (varied formatting, domain-specific terminology, inconsistent structure)
- Real operational workflows with genuine edge cases, unusual procurement scenarios, or non-standard lab configurations
- Real user behavior — how lab members actually phrase questions, what they expect from AI responses, where the current responses fall short

The AI components are functional and constrained by design, but their real-world utility is unproven. The honest position is: **the AI works as designed in the demo environment; whether it adds genuine operational value requires testing with a real client and real data.**

This is not a failure of implementation — it reflects the normal progression from MVP to validated product. The platform was intentionally designed to make this validation phase safe (constrained AI, human-in-the-loop, full audit logging) so that real-world testing can proceed without risk of autonomous errors.

---

## 2. AI-Specific Limitations

### Vision Extraction (Package Intake)

- Tested only on a small set of curated demo images. Real package photos may have poor lighting, partial label occlusion, non-standard label formats, or multiple SKUs on one package.
- The mock extraction mode is deterministic and URL-keyed — it does not reflect the variability of live extraction.
- Live extraction confidence levels (`high`, `medium`, `low`) are returned by the model's self-assessment, not validated against ground truth. Their calibration has not been tested.
- There is no feedback loop — verified and rejected extractions do not currently improve future extraction quality.

### Knowledge Base RAG Assistant

- Answer quality is heavily dependent on document quality. SOPs that are poorly structured, inconsistently formatted, or rely heavily on external references will produce weak retrieval and incomplete answers.
- Chunk size (≈800 characters) is a fixed heuristic. Documents with dense technical content may be split at semantically important boundaries. Documents with very long sections may require more chunks to cover a topic than the top-5 retrieval limit surfaces.
- The IVFFlat pgvector index (lists=5) is configured for small-scale datasets. It will need reindexing (`REINDEX` or `CREATE INDEX`) as the document corpus grows significantly.
- Cross-document synthesis (answering questions that span multiple SOPs) may produce incomplete answers if the relevant content is split across documents that don't rank high individually.
- The RAG system has no conversation memory. Each question is treated independently. Follow-up questions that depend on prior context ("what about the second step?") will not work correctly.

### Operational Copilot

- Context is built from the top 30 inventory items, 15 open tasks, 10 pending packages, and 10 procurement requests. In a lab with more active data, the most relevant items may fall outside these limits.
- The copilot answers from a snapshot of data assembled at query time. It has no awareness of data that changes after the query starts.
- Response quality depends on the richness of the context. A lab with sparse data (few items, few tasks) will get less useful copilot responses than a lab actively using all features.
- The copilot redirects SOP and policy questions to the KB assistant, but cannot tell the user where to find a specific document — it can only direct them to the KB page.

---

## 3. Evaluation and Testing Limitations

### Lightweight eval suite

The eval system (`evals/basic_ai_eval_cases.json` + `run_basic_ai_evals.py`) covers 15 cases across RAG and the copilot. These cases test the most important behavioral properties: refusal, redirection, RBAC filtering, injection resistance, and basic answer quality against dummy context.

This is a starting point, not a comprehensive eval framework. Current gaps:

- No eval coverage for vision extraction quality
- No adversarial or edge-case prompt testing beyond the basic injection case
- No evaluation of answer correctness against a reference — only keyword presence checks
- No regression tracking over time — evals are run manually with no history
- Dummy context used in copilot evals does not reflect real lab data variability
- No latency or cost benchmarking

A production-grade AI evaluation framework would include ground-truth reference answers, automated regression detection, multi-turn dialogue testing, and systematic adversarial testing. ALMA LabOps has the scaffold for this but not the substance.

### No production monitoring

There is no alerting, dashboarding, or anomaly detection on AI output quality in production. The `ai_audit_logs` table captures every interaction with model, status, tokens, and response summary — this is the raw material for operational monitoring — but no tooling currently processes it. Patterns like elevated refusal rates, unexpectedly high token counts, or model errors would only be visible by querying the table directly.

---

## 4. Operational Software Limitations

### Audit logs and settings will continue to evolve

The audit log viewer currently supports filtering by role, resource type, event type, and date range. As more operational workflows are instrumented and the data volume grows, the current implementation will need pagination, export, and more granular filtering. The settings page is currently read-only for most configuration — making settings genuinely configurable (e.g. adjustable inventory thresholds, notification preferences, AI behavior toggles) is future work.

### Permission delegation is limited

The current delegation system supports one delegatable permission (`view_audit_logs`). The architecture supports adding more delegatable permissions, but the set of permissions, the UI for managing them, and any approval workflow for delegation requests have not been built.

### No notifications or alerting

There are no email, Slack, or in-app notifications. Low-stock items, overdue tasks, pending approvals, and packages awaiting review are all surfaced on the dashboard and action queue, but a lab member who does not open the app will not be alerted. This is a meaningful operational gap — a low-stock item that nobody checks the dashboard about does not get reordered.

### No real-time data sync

The frontend loads data on mount and after user-initiated actions. There is no WebSocket connection or polling mechanism. If two users are working simultaneously, each sees the state as of their last page load or action. For a small lab team this is acceptable; for concurrent workflows it can cause stale-state confusion.

### No advanced analytics or reporting

The platform shows current operational state: how many items are in stock now, which tasks are open now, which requests are pending now. It does not show trends, consumption rates, procurement cycle times, or any historical analysis. These are valuable operational metrics but require a meaningful history of real data before they are worth building.

---

## 5. Infrastructure and Security Limitations

### No enterprise SSO

Authentication uses Supabase email/password. The login page communicates future SSO intent, and Supabase supports enterprise identity providers, but institution SSO (Microsoft Entra, Google Workspace) is not implemented. For a real client deployment, this would be a prerequisite.

### No production hardening

This is an MVP. It has not been through:
- Security penetration testing
- Load testing or performance profiling
- Production incident response procedures
- Backup and restore validation
- GDPR or HIPAA compliance review

The architecture follows reasonable security practices (service role key backend-only, RLS enabled, JWT validation, no raw SQL in application code), but "follows good practices" is not the same as "production-hardened for a regulated research environment."

### Single lab per deployment

The schema supports multiple organizations and multiple labs per organization, but the application is designed and seeded for a single-lab context. Multi-tenant isolation at the product level (a PI managing multiple labs, an institution admin view) is not implemented.

---

## 6. What Was Intentionally Kept Conservative

Several features that might seem obvious for an AI-assisted platform were intentionally held back. This was not an oversight — it was a deliberate choice to prioritize reliability over capability.

**No autonomous procurement suggestions.** The copilot can tell a PI which items are low stock and which requests are pending, but it does not generate draft purchase requests autonomously. The risk of an incorrect or poorly-timed automated procurement action in a lab context outweighs the convenience.

**No autonomous inventory modifications.** Package extraction produces a draft that requires human review. The AI does not create inventory items, adjust quantities, or move items between locations without explicit user confirmation at each step.

**No AI-generated onboarding summaries on login.** A "here's what happened while you were away" AI summary on the dashboard would require an OpenAI call on every login. At MVP scale with seeded data, this adds cost without genuine informational value. With real data, this becomes worth reconsidering.

**No proactive AI suggestions.** The copilot answers questions; it does not proactively surface suggestions. An AI that surfaces unprompted suggestions introduces a responsibility question (what if the suggestion is wrong? what if the user acts on it reflexively?) that is worth addressing deliberately, not as a side feature.

These constraints reflect a consistent principle: in an operational context, the cost of an incorrect AI action is higher than the cost of a missed convenience. Reliability and auditability come first.

---

## 7. Forward Direction

The following areas are natural next steps once the platform has been validated with a real client:

- **Real-world AI validation** — test vision extraction, RAG, and the copilot against actual lab data and gather structured feedback on where AI responses fall short
- **Iterative prompt refinement** — adjust system prompts based on real query patterns, refusal rates, and user feedback
- **Expanded eval suite** — add ground-truth reference answers, adversarial cases, multi-turn scenarios, and automated regression tracking
- **Production monitoring** — build an operational view over `ai_audit_logs` to surface error rates, refusal rates, and token trends
- **Notification system** — email or Slack alerts for low-stock items, overdue tasks, and pending approvals
- **Granular RBAC** — more delegatable permissions, a more complete permissions management UI, and possibly a formal approval flow for delegation
- **Analytics layer** — inventory consumption trends, procurement cycle time, task completion rates — once real data accumulates
- **Enterprise SSO** — Supabase supports this; the implementation work is UI and configuration, not architectural
- **AI governance tooling** — structured review of AI outputs, human feedback capture, and model performance tracking over time
