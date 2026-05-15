"""Operational copilot service — RBAC-aware context retrieval + AI answer generation."""

from supabase import Client

from app.models.auth import CurrentUser
from app.ai.copilot import generate_copilot_answer


class CopilotService:
    def __init__(self, db: Client) -> None:
        self.db = db

    # ── Context builders ──────────────────────────────────────────────────────

    def _inventory_context(self, lab_id: str) -> dict:
        result = (
            self.db.table("inventory_items")
            .select("name, quantity, unit, threshold, vendor, inventory_locations(name), inventory_categories(name)")
            .eq("lab_id", lab_id)
            .limit(30)
            .execute()
        )
        items = []
        for row in (result.data or []):
            qty = float(row.get("quantity") or 0)
            thr = float(row.get("threshold") or 0)
            if qty <= 0:
                status = "out_of_stock"
            elif thr > 0 and qty <= thr:
                status = "low_stock"
            else:
                status = "in_stock"
            items.append({
                "name": row["name"],
                "quantity": qty,
                "unit": row.get("unit", ""),
                "status": status,
                "location_name": (row.get("inventory_locations") or {}).get("name"),
                "vendor": row.get("vendor"),
            })
        low = [i for i in items if i["status"] in ("low_stock", "out_of_stock")]
        return {"total": len(items), "low_stock": low, "items": items}

    def _tasks_context(self, lab_id: str, user_id: str, role: str) -> list[dict]:
        query = (
            self.db.table("tasks")
            .select("title, status, priority, assigned_to_name, due_date, task_type")
            .eq("lab_id", lab_id)
            .neq("status", "completed")
            .limit(15)
        )
        if role == "student":
            query = query.eq("assigned_to", user_id)
        return query.execute().data or []

    def _packages_context(self, lab_id: str) -> list[dict]:
        return (
            self.db.table("incoming_packages")
            .select(
                "extracted_item_name, extracted_vendor, extracted_quantity, "
                "extracted_unit, review_status, extraction_status, uploaded_by_name"
            )
            .eq("lab_id", lab_id)
            .eq("extraction_status", "completed")
            .eq("review_status", "pending")
            .limit(10)
            .execute()
        ).data or []

    def _procurement_context(self, lab_id: str) -> list[dict]:
        return (
            self.db.table("purchase_requests")
            .select("title, status, urgency, requester_name, estimated_total")
            .eq("lab_id", lab_id)
            .in_("status", ["pending_approval", "draft"])
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        ).data or []

    def _activity_context(self, lab_id: str) -> list[dict]:
        return (
            self.db.table("audit_logs")
            .select("event_type, description, actor_role, created_at")
            .eq("lab_id", lab_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        ).data or []

    # ── Context assembly ──────────────────────────────────────────────────────

    def build_context(self, user: CurrentUser) -> list[dict]:
        """Assemble RBAC-appropriate operational context sections."""
        sections: list[dict] = []

        # Inventory — all roles
        inv = self._inventory_context(user.lab_id)
        lines = [f"Total inventory items: {inv['total']}"]
        if inv["low_stock"]:
            lines.append(f"Low / out-of-stock ({len(inv['low_stock'])}):")
            for item in inv["low_stock"][:10]:
                loc = item.get("location_name") or "no location"
                lines.append(
                    f"  - {item['name']}: {item['quantity']} {item['unit']} "
                    f"({item['status']}, {loc})"
                )
        else:
            lines.append("No low-stock items currently.")
        lines.append("\nFull inventory:")
        for item in inv["items"]:
            lines.append(
                f"  - {item['name']}: {item['quantity']} {item['unit']}, "
                f"status={item['status']}, "
                f"location={item.get('location_name') or 'N/A'}, "
                f"vendor={item.get('vendor') or 'N/A'}"
            )
        sections.append({"title": "Inventory", "content": "\n".join(lines)})

        # Tasks — all roles (students see only their own)
        tasks = self._tasks_context(user.lab_id, user.id, user.role)
        if tasks:
            lines = [f"Open tasks ({len(tasks)}):"]
            for t in tasks:
                due = f", due {t['due_date'][:10]}" if t.get("due_date") else ""
                overdue = " ⚠ OVERDUE" if (
                    t.get("due_date") and t["due_date"][:10] < "2026-05-15"
                ) else ""
                lines.append(
                    f"  - [{t['priority'].upper()}] {t['title']} "
                    f"— {t.get('assigned_to_name') or 'Unassigned'}, "
                    f"status={t['status']}{due}{overdue}"
                )
        else:
            lines = ["No open tasks."]
        sections.append({"title": "Tasks", "content": "\n".join(lines)})

        # Incoming packages — researcher + PI
        if user.role in ("pi", "researcher"):
            pkgs = self._packages_context(user.lab_id)
            if pkgs:
                lines = [f"Packages pending review ({len(pkgs)}):"]
                for p in pkgs:
                    lines.append(
                        f"  - {p.get('extracted_item_name') or 'Unknown'}: "
                        f"{p.get('extracted_quantity', '?')} {p.get('extracted_unit', '')}, "
                        f"vendor={p.get('extracted_vendor') or 'N/A'}, "
                        f"uploaded by {p.get('uploaded_by_name') or 'N/A'}"
                    )
            else:
                lines = ["No packages currently pending review."]
            sections.append({"title": "Incoming Packages", "content": "\n".join(lines)})

        # Procurement — researcher + PI
        if user.role in ("pi", "researcher"):
            reqs = self._procurement_context(user.lab_id)
            if reqs:
                lines = [f"Purchase requests ({len(reqs)}):"]
                for r in reqs:
                    est = f", est. ${r['estimated_total']:.2f}" if r.get("estimated_total") else ""
                    lines.append(
                        f"  - [{r['urgency'].upper()}] {r['title']} "
                        f"— {r['status']}, by {r['requester_name']}{est}"
                    )
            else:
                lines = ["No pending purchase requests."]
            sections.append({"title": "Procurement", "content": "\n".join(lines)})

        # Recent activity — PI + researcher
        if user.role in ("pi", "researcher"):
            activity = self._activity_context(user.lab_id)
            if activity:
                lines = ["Recent lab activity:"]
                for a in activity:
                    ts = a["created_at"][:10] if a.get("created_at") else ""
                    lines.append(
                        f"  - [{ts}] {a['description']} "
                        f"({a.get('actor_role') or 'system'})"
                    )
                sections.append({"title": "Recent Activity", "content": "\n".join(lines)})

        return sections

    # ── Logging ───────────────────────────────────────────────────────────────

    def log_query(
        self,
        *,
        lab_id: str,
        user_id: str,
        user_role: str,
        question: str,
        answer: str | None,
        was_refused: bool,
        model_used: str,
        tokens_used: int | None,
        context_sources: list[str],
    ) -> dict:
        result = self.db.table("copilot_queries").insert({
            "lab_id":          lab_id,
            "user_id":         user_id,
            "user_role":       user_role,
            "question":        question,
            "answer":          answer,
            "was_refused":     was_refused,
            "model_used":      model_used,
            "tokens_used":     tokens_used,
            "context_summary": {"sources": context_sources},
        }).execute()
        return result.data[0]

    # ── Main entry point ──────────────────────────────────────────────────────

    async def ask(self, question: str, user: CurrentUser) -> dict:
        """Build context → generate answer → log → return."""
        context_sections = self.build_context(user)
        result = await generate_copilot_answer(
            question=question,
            context_sections=context_sections,
            user_role=user.role,
        )
        context_sources = [s["title"] for s in context_sections]
        self.log_query(
            lab_id=user.lab_id,
            user_id=user.id,
            user_role=user.role,
            question=question,
            answer=result["answer"],
            was_refused=result["was_refused"],
            model_used="gpt-4.1-mini",
            tokens_used=result.get("tokens_used"),
            context_sources=context_sources,
        )
        return {**result, "context_sources": context_sources}
