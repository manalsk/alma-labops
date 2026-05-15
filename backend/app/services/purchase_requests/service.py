"""Purchase request service — procurement workflow business logic."""

from collections import Counter
from typing import Any

from supabase import Client

from app.models.auth import CurrentUser
from app.services.audit_logs.service import AuditLogService


def _compute_estimated_total(items: list[dict]) -> float | None:
    total = 0.0
    any_priced = False
    for item in items:
        price = item.get("estimated_unit_price")
        if price is not None:
            total += float(item.get("quantity", 1)) * float(price)
            any_priced = True
    return round(total, 2) if any_priced else None


class ProcurementService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self.audit = AuditLogService(db)

    # ── Vendors ────────────────────────────────────────────────────────────────

    def list_vendors(self, lab_id: str) -> list[dict]:
        result = (
            self.db.table("vendors")
            .select("*")
            .eq("lab_id", lab_id)
            .order("name")
            .execute()
        )
        return result.data or []

    def _get_vendor_name(self, vendor_id: str | None) -> str | None:
        if not vendor_id:
            return None
        result = (
            self.db.table("vendors")
            .select("name")
            .eq("id", vendor_id)
            .limit(1)
            .execute()
        )
        return result.data[0]["name"] if result.data else None

    # ── Requests ───────────────────────────────────────────────────────────────

    def list_requests(
        self,
        lab_id: str,
        status: str | None = None,
        urgency: str | None = None,
        requester_id: str | None = None,
        vendor_id: str | None = None,
    ) -> list[dict]:
        q = (
            self.db.table("purchase_requests")
            .select("*")
            .eq("lab_id", lab_id)
            .order("created_at", desc=True)
        )
        if status:
            q = q.eq("status", status)
        if urgency:
            q = q.eq("urgency", urgency)
        if requester_id:
            q = q.eq("requester_id", requester_id)
        if vendor_id:
            q = q.eq("vendor_id", vendor_id)
        result = q.execute()
        requests = result.data or []

        if requests:
            ids = [r["id"] for r in requests]
            items_result = (
                self.db.table("purchase_request_items")
                .select("request_id")
                .in_("request_id", ids)
                .execute()
            )
            counts = Counter(row["request_id"] for row in (items_result.data or []))
            for req in requests:
                req["item_count"] = counts.get(req["id"], 0)
        return requests

    def get_request(self, request_id: str, lab_id: str) -> dict | None:
        result = (
            self.db.table("purchase_requests")
            .select("*")
            .eq("id", request_id)
            .eq("lab_id", lab_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        req = result.data[0]
        items_result = (
            self.db.table("purchase_request_items")
            .select("*")
            .eq("request_id", request_id)
            .order("created_at")
            .execute()
        )
        req["items"] = items_result.data or []
        return req

    def create_request(self, data: dict, actor: CurrentUser) -> dict | None:
        items_data = data.pop("items", [])
        submit = data.pop("submit", False)

        vendor_name = self._get_vendor_name(data.get("vendor_id"))
        is_student = actor.role == "student"
        initial_status = "pending_approval" if (submit or is_student) else "draft"

        row = {
            **data,
            "lab_id": actor.lab_id,
            "org_id": actor.org_id,
            "requester_id": actor.id,
            "requester_name": actor.full_name,
            "vendor_name": vendor_name,
            "status": initial_status,
            "is_suggestion": is_student,
        }

        result = self.db.table("purchase_requests").insert(row).execute()
        req = result.data[0]
        request_id = req["id"]

        if items_data:
            item_rows = [{**item, "request_id": request_id} for item in items_data]
            self.db.table("purchase_request_items").insert(item_rows).execute()

        self._refresh_estimated_total(request_id)

        self._log_activity(
            request_id=request_id,
            lab_id=actor.lab_id,
            actor=actor,
            action="created",
            new_status=initial_status,
        )
        if initial_status == "pending_approval":
            self._log_activity(
                request_id=request_id,
                lab_id=actor.lab_id,
                actor=actor,
                action="submitted",
                old_status="draft",
                new_status="pending_approval",
            )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="procurement.created",
            resource_type="purchase_request",
            resource_id=request_id,
            description=f'{actor.full_name} created purchase request "{req["title"]}"',
            lab_id=actor.lab_id,
        )
        return self.get_request(request_id, actor.lab_id)

    def update_request(self, request_id: str, data: dict, actor: CurrentUser) -> dict | None:
        items_data = data.pop("items", None)

        if data:
            if "vendor_id" in data:
                data["vendor_name"] = self._get_vendor_name(data["vendor_id"])
            self.db.table("purchase_requests").update(data).eq("id", request_id).eq("lab_id", actor.lab_id).execute()

        if items_data is not None:
            self.db.table("purchase_request_items").delete().eq("request_id", request_id).execute()
            if items_data:
                item_rows = [{**item, "request_id": request_id} for item in items_data]
                self.db.table("purchase_request_items").insert(item_rows).execute()
            self._refresh_estimated_total(request_id)

        self._log_activity(
            request_id=request_id,
            lab_id=actor.lab_id,
            actor=actor,
            action="edited",
        )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="procurement.edited",
            resource_type="purchase_request",
            resource_id=request_id,
            description=f"{actor.full_name} edited purchase request",
            lab_id=actor.lab_id,
        )
        return self.get_request(request_id, actor.lab_id)

    def submit_request(self, request_id: str, actor: CurrentUser) -> dict | None:
        self.db.table("purchase_requests").update({"status": "pending_approval"}).eq("id", request_id).eq("lab_id", actor.lab_id).execute()
        self._log_activity(
            request_id=request_id,
            lab_id=actor.lab_id,
            actor=actor,
            action="submitted",
            old_status="draft",
            new_status="pending_approval",
        )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="procurement.submitted",
            resource_type="purchase_request",
            resource_id=request_id,
            description=f"{actor.full_name} submitted purchase request for approval",
            lab_id=actor.lab_id,
        )
        return self.get_request(request_id, actor.lab_id)

    def approve_request(self, request_id: str, notes: str | None, actor: CurrentUser) -> dict | None:
        import datetime
        self.db.table("purchase_requests").update({
            "status": "approved",
            "approved_by": actor.id,
            "approver_name": actor.full_name,
            "approved_at": datetime.datetime.utcnow().isoformat(),
        }).eq("id", request_id).eq("lab_id", actor.lab_id).execute()
        self._log_activity(
            request_id=request_id,
            lab_id=actor.lab_id,
            actor=actor,
            action="approved",
            old_status="pending_approval",
            new_status="approved",
            notes=notes,
        )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="procurement.approved",
            resource_type="purchase_request",
            resource_id=request_id,
            description=f"{actor.full_name} approved purchase request",
            lab_id=actor.lab_id,
            metadata={"notes": notes},
        )
        return self.get_request(request_id, actor.lab_id)

    def reject_request(self, request_id: str, notes: str | None, actor: CurrentUser) -> dict | None:
        import datetime
        self.db.table("purchase_requests").update({
            "status": "rejected",
            "rejected_at": datetime.datetime.utcnow().isoformat(),
            "rejection_reason": notes,
        }).eq("id", request_id).eq("lab_id", actor.lab_id).execute()
        self._log_activity(
            request_id=request_id,
            lab_id=actor.lab_id,
            actor=actor,
            action="rejected",
            old_status="pending_approval",
            new_status="rejected",
            notes=notes,
        )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="procurement.rejected",
            resource_type="purchase_request",
            resource_id=request_id,
            description=f"{actor.full_name} rejected purchase request",
            lab_id=actor.lab_id,
        )
        return self.get_request(request_id, actor.lab_id)

    def request_clarification(self, request_id: str, note: str, actor: CurrentUser) -> dict | None:
        import datetime
        self.db.table("purchase_requests").update({
            "clarification_note": note,
            "clarification_requested_at": datetime.datetime.utcnow().isoformat(),
        }).eq("id", request_id).eq("lab_id", actor.lab_id).execute()
        self._log_activity(
            request_id=request_id,
            lab_id=actor.lab_id,
            actor=actor,
            action="clarification_requested",
            notes=note,
        )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="procurement.clarification_requested",
            resource_type="purchase_request",
            resource_id=request_id,
            description=f"{actor.full_name} requested clarification on purchase request",
            lab_id=actor.lab_id,
        )
        return self.get_request(request_id, actor.lab_id)

    def mark_ordered(self, request_id: str, actor: CurrentUser) -> dict | None:
        import datetime
        self.db.table("purchase_requests").update({
            "status": "ordered",
            "ordered_at": datetime.datetime.utcnow().isoformat(),
        }).eq("id", request_id).eq("lab_id", actor.lab_id).execute()
        self._log_activity(
            request_id=request_id,
            lab_id=actor.lab_id,
            actor=actor,
            action="ordered",
            old_status="approved",
            new_status="ordered",
        )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="procurement.ordered",
            resource_type="purchase_request",
            resource_id=request_id,
            description=f"{actor.full_name} marked purchase request as ordered",
            lab_id=actor.lab_id,
        )
        return self.get_request(request_id, actor.lab_id)

    def mark_received(self, request_id: str, actor: CurrentUser) -> dict | None:
        import datetime
        self.db.table("purchase_requests").update({
            "status": "received",
            "received_at": datetime.datetime.utcnow().isoformat(),
        }).eq("id", request_id).eq("lab_id", actor.lab_id).execute()
        self._log_activity(
            request_id=request_id,
            lab_id=actor.lab_id,
            actor=actor,
            action="received",
            old_status="ordered",
            new_status="received",
        )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="procurement.received",
            resource_type="purchase_request",
            resource_id=request_id,
            description=f"{actor.full_name} marked purchase request as received",
            lab_id=actor.lab_id,
        )
        return self.get_request(request_id, actor.lab_id)

    def delete_request(self, request_id: str, actor: CurrentUser) -> None:
        req = self.get_request(request_id, actor.lab_id)
        if not req:
            return
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="procurement.deleted",
            resource_type="purchase_request",
            resource_id=request_id,
            description=f'{actor.full_name} deleted purchase request "{req["title"]}"',
            lab_id=actor.lab_id,
        )
        self.db.table("purchase_requests").delete().eq("id", request_id).eq("lab_id", actor.lab_id).execute()

    def list_activity(self, request_id: str) -> list[dict]:
        result = (
            self.db.table("procurement_activity_logs")
            .select("*")
            .eq("request_id", request_id)
            .order("created_at")
            .execute()
        )
        return result.data or []

    # ── Internal ───────────────────────────────────────────────────────────────

    def _refresh_estimated_total(self, request_id: str) -> None:
        result = (
            self.db.table("purchase_request_items")
            .select("quantity,estimated_unit_price")
            .eq("request_id", request_id)
            .execute()
        )
        total = _compute_estimated_total(result.data or [])
        self.db.table("purchase_requests").update({"estimated_total": total}).eq("id", request_id).execute()

    def _log_activity(
        self,
        *,
        request_id: str,
        lab_id: str,
        actor: CurrentUser,
        action: str,
        old_status: str | None = None,
        new_status: str | None = None,
        notes: str | None = None,
    ) -> None:
        self.db.table("procurement_activity_logs").insert({
            "request_id": request_id,
            "lab_id": lab_id,
            "actor_id": actor.id,
            "actor_name": actor.full_name,
            "action": action,
            "old_status": old_status,
            "new_status": new_status,
            "notes": notes,
        }).execute()
