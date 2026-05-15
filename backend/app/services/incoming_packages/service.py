"""Incoming package service — AI-assisted package intake business logic."""
import datetime
import uuid as _uuid

from supabase import Client

from app.models.auth import CurrentUser
from app.services.audit_logs.service import AuditLogService


class IncomingPackageService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self.audit = AuditLogService(db)

    # ── Queries ───────────────────────────────────────────────────────────────

    def list_packages(
        self,
        lab_id: str,
        review_status: str | None = None,
        extraction_status: str | None = None,
        uploaded_by: str | None = None,
    ) -> list[dict]:
        q = (
            self.db.table("incoming_packages")
            .select("*")
            .eq("lab_id", lab_id)
            .order("created_at", desc=True)
        )
        if review_status:
            q = q.eq("review_status", review_status)
        if extraction_status:
            q = q.eq("extraction_status", extraction_status)
        if uploaded_by:
            q = q.eq("uploaded_by", uploaded_by)
        return q.execute().data or []

    def get_package(self, package_id: str, lab_id: str) -> dict | None:
        result = (
            self.db.table("incoming_packages")
            .select("*")
            .eq("id", package_id)
            .eq("lab_id", lab_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    # ── Upload / Create ───────────────────────────────────────────────────────

    def upload_to_storage(
        self,
        image_bytes: bytes,
        filename: str,
        content_type: str,
        lab_id: str,
    ) -> tuple[str, str]:
        """Upload image bytes to Supabase Storage. Returns (storage_path, signed_url)."""
        package_id = str(_uuid.uuid4())
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
        path = f"lab/{lab_id}/{package_id}.{ext}"
        self.db.storage.from_("package-images").upload(
            path=path,
            file=image_bytes,
            file_options={"content-type": content_type},
        )
        signed = self.db.storage.from_("package-images").create_signed_url(path, expires_in=31536000)
        signed_url = signed.get("signedURL") or signed.get("signed_url") or ""
        return path, signed_url

    def create_package(
        self,
        image_url: str,
        image_path: str | None,
        actor: CurrentUser,
    ) -> dict:
        row = {
            "lab_id": actor.lab_id,
            "org_id": actor.org_id,
            "image_url": image_url,
            "image_path": image_path,
            "uploaded_by": actor.id,
            "uploaded_by_name": actor.full_name,
            "extraction_status": "pending",
            "review_status": "pending",
        }
        result = self.db.table("incoming_packages").insert(row).execute()
        pkg = result.data[0]

        self._log_activity(
            package_id=pkg["id"], lab_id=actor.lab_id, actor=actor, action="uploaded"
        )
        self.audit.log_event(
            actor_id=actor.id, actor_role=actor.role,
            event_type="package.uploaded", resource_type="package", resource_id=pkg["id"],
            description=f"{actor.full_name} uploaded a package image",
            lab_id=actor.lab_id,
        )
        return pkg

    # ── Extraction ────────────────────────────────────────────────────────────

    def save_extraction(
        self,
        package_id: str,
        lab_id: str,
        extraction: dict,
        mode: str,
        actor: CurrentUser,
        tokens_used: int | None = None,
        prior_review_status: str | None = None,
    ) -> dict | None:
        patch = {
            "extracted_item_name": extraction.get("item_name"),
            "extracted_vendor": extraction.get("vendor"),
            "extracted_quantity": extraction.get("quantity"),
            "extracted_unit": extraction.get("unit"),
            "extracted_catalog_number": extraction.get("catalog_number"),
            "extracted_category": extraction.get("category"),
            "extracted_storage_condition": extraction.get("storage_condition"),
            "extraction_confidence": extraction.get("confidence"),
            "extraction_notes": extraction.get("notes"),
            "extraction_raw_json": extraction,
            "extraction_mode": "live_ai" if mode == "live" else "mocked",
            "extraction_status": "completed",
        }
        if prior_review_status == "rejected":
            patch["review_status"] = "pending"
            patch["reviewed_by"] = None
            patch["reviewed_at"] = None
        self.db.table("incoming_packages").update(patch).eq("id", package_id).eq("lab_id", lab_id).execute()

        action = "mocked_extraction" if mode == "mocked" else "ai_extraction"
        self._log_activity(
            package_id=package_id, lab_id=lab_id, actor=actor, action=action,
            notes=f"Confidence: {extraction.get('confidence', 'unknown')}",
        )

        model_label = "mocked" if mode == "mocked" else "gpt-4o"
        self.audit.log_ai_interaction(
            user_id=actor.id,
            user_role=actor.role,
            prompt="Package label extraction",
            tool_called="package_vision",
            model_used=model_label,
            response_summary=f"Extracted: {extraction.get('item_name')} — confidence: {extraction.get('confidence')}",
            status="success",
            lab_id=lab_id,
            package_id=package_id,
            tokens_used=tokens_used,
            metadata={
                "extraction_mode": mode,
                "catalog_number": extraction.get("catalog_number"),
                "confidence": extraction.get("confidence"),
            },
        )
        return self.get_package(package_id, lab_id)

    def mark_extraction_failed(
        self,
        package_id: str,
        lab_id: str,
        actor: CurrentUser,
        error: str,
    ) -> None:
        self.db.table("incoming_packages").update({
            "extraction_status": "failed",
            "extraction_notes": error,
        }).eq("id", package_id).eq("lab_id", lab_id).execute()

        self._log_activity(
            package_id=package_id, lab_id=lab_id, actor=actor,
            action="extraction_failed", notes=error,
        )
        self.audit.log_ai_interaction(
            user_id=actor.id, user_role=actor.role,
            prompt="Package label extraction",
            tool_called="package_vision",
            model_used="gpt-4o",
            response_summary=f"Extraction failed: {error}",
            status="error",
            lab_id=lab_id,
            package_id=package_id,
        )

    # ── Human Review ──────────────────────────────────────────────────────────

    def verify_extraction(
        self,
        package_id: str,
        data: dict,
        actor: CurrentUser,
    ) -> dict | None:
        lab_id = actor.lab_id
        patch: dict = {
            "review_status": "verified",
            "reviewed_by": actor.id,
            "reviewed_at": datetime.datetime.utcnow().isoformat(),
        }
        field_overrides = {
            "extracted_item_name": data.get("extracted_item_name"),
            "extracted_vendor": data.get("extracted_vendor"),
            "extracted_quantity": data.get("extracted_quantity"),
            "extracted_unit": data.get("extracted_unit"),
            "extracted_catalog_number": data.get("extracted_catalog_number"),
            "extracted_category": data.get("extracted_category"),
            "extracted_storage_condition": data.get("extracted_storage_condition"),
            "extraction_notes": data.get("extraction_notes"),
        }
        patch.update({k: v for k, v in field_overrides.items() if v is not None})

        self.db.table("incoming_packages").update(patch).eq("id", package_id).eq("lab_id", lab_id).execute()
        self._log_activity(package_id=package_id, lab_id=lab_id, actor=actor, action="extraction_verified")
        self.audit.log_event(
            actor_id=actor.id, actor_role=actor.role,
            event_type="package.extraction_verified", resource_type="package", resource_id=package_id,
            description=f"{actor.full_name} verified package extraction",
            lab_id=lab_id,
        )
        return self.get_package(package_id, lab_id)

    def reject_extraction(
        self,
        package_id: str,
        notes: str | None,
        actor: CurrentUser,
    ) -> dict | None:
        lab_id = actor.lab_id
        self.db.table("incoming_packages").update({
            "review_status": "rejected",
            "reviewed_by": actor.id,
            "reviewed_at": datetime.datetime.utcnow().isoformat(),
        }).eq("id", package_id).eq("lab_id", lab_id).execute()

        self._log_activity(
            package_id=package_id, lab_id=lab_id, actor=actor,
            action="extraction_rejected", notes=notes,
        )
        self.audit.log_event(
            actor_id=actor.id, actor_role=actor.role,
            event_type="package.extraction_rejected", resource_type="package", resource_id=package_id,
            description=f"{actor.full_name} rejected package extraction",
            lab_id=lab_id,
        )
        return self.get_package(package_id, lab_id)

    # ── Inventory Integration ─────────────────────────────────────────────────

    def create_inventory_from_package(
        self,
        package_id: str,
        data: dict,
        actor: CurrentUser,
    ) -> dict | None:
        pkg = self.get_package(package_id, actor.lab_id)
        if not pkg:
            return None

        item_name = data.get("item_name") or pkg.get("extracted_item_name") or "Unknown Item"
        quantity = float(data.get("quantity") or pkg.get("extracted_quantity") or 0)
        unit = data.get("unit") or pkg.get("extracted_unit") or "units"
        catalog_number = data.get("catalog_number") or pkg.get("extracted_catalog_number")
        vendor = data.get("vendor") or pkg.get("extracted_vendor")

        inv_row = {
            "lab_id": actor.lab_id,
            "name": item_name,
            "quantity": quantity,
            "unit": unit,
            "threshold": data.get("threshold", 0),
            "reorder_quantity": data.get("reorder_quantity", 0),
            "catalog_number": catalog_number,
            "vendor": vendor,
            "notes": data.get("notes"),
            "category_id": data.get("category_id") or None,
            "location_id": data.get("location_id") or None,
            "created_by": actor.id,
        }
        inv_result = self.db.table("inventory_items").insert(inv_row).execute()
        inv_item = inv_result.data[0]

        self.db.table("incoming_packages").update({
            "linked_inventory_item_id": inv_item["id"],
        }).eq("id", package_id).eq("lab_id", actor.lab_id).execute()

        self._log_activity(
            package_id=package_id, lab_id=actor.lab_id, actor=actor, action="inventory_created",
            notes=f"Created: {item_name}",
        )
        self.audit.log_event(
            actor_id=actor.id, actor_role=actor.role,
            event_type="package.inventory_created", resource_type="package", resource_id=package_id,
            description=f'{actor.full_name} created inventory item "{item_name}" from package',
            lab_id=actor.lab_id,
            metadata={"inventory_item_id": inv_item["id"], "item_name": item_name},
        )
        return self.get_package(package_id, actor.lab_id)

    # ── Task Integration ──────────────────────────────────────────────────────

    def create_task_from_package(
        self,
        package_id: str,
        data: dict,
        actor: CurrentUser,
    ) -> dict | None:
        pkg = self.get_package(package_id, actor.lab_id)
        if not pkg:
            return None

        item_name = pkg.get("extracted_item_name") or "package"
        title = data.get("title") or f"Unpack and store: {item_name}"
        description = data.get("description") or (
            f"Package received. Unpack and store in the correct location.\n"
            f"Vendor: {pkg.get('extracted_vendor') or 'Unknown'}\n"
            f"Catalog #: {pkg.get('extracted_catalog_number') or 'N/A'}\n"
            f"Quantity: {pkg.get('extracted_quantity') or '?'} {pkg.get('extracted_unit') or ''}"
        )

        assigned_to = data.get("assigned_to")
        assigned_to_name: str | None = None
        if assigned_to:
            res = self.db.table("profiles").select("full_name").eq("id", assigned_to).limit(1).execute()
            assigned_to_name = res.data[0]["full_name"] if res.data else None

        task_row = {
            "lab_id": actor.lab_id,
            "org_id": actor.org_id,
            "title": title,
            "description": description,
            "status": "todo",
            "priority": data.get("priority", "medium"),
            "task_type": "package_intake",
            "assigned_to": assigned_to,
            "assigned_to_name": assigned_to_name,
            "created_by": actor.id,
            "created_by_name": actor.full_name,
            "due_date": data.get("due_date"),
            "related_package_id": package_id,
        }
        task_result = self.db.table("tasks").insert(task_row).execute()
        task = task_result.data[0]

        self.db.table("incoming_packages").update({
            "linked_task_id": task["id"],
        }).eq("id", package_id).eq("lab_id", actor.lab_id).execute()

        self._log_activity(
            package_id=package_id, lab_id=actor.lab_id, actor=actor, action="task_created",
            notes=f"Task: {title}",
        )
        self.audit.log_event(
            actor_id=actor.id, actor_role=actor.role,
            event_type="package.task_created", resource_type="package", resource_id=package_id,
            description=f"{actor.full_name} created an unpacking task from package",
            lab_id=actor.lab_id,
            metadata={"task_id": task["id"], "task_title": title},
        )
        return self.get_package(package_id, actor.lab_id)

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def mark_processed(self, package_id: str, actor: CurrentUser) -> dict | None:
        lab_id = actor.lab_id
        self.db.table("incoming_packages").update({
            "processed_at": datetime.datetime.utcnow().isoformat(),
            "review_status": "verified",
        }).eq("id", package_id).eq("lab_id", lab_id).execute()

        self._log_activity(package_id=package_id, lab_id=lab_id, actor=actor, action="processed")
        self.audit.log_event(
            actor_id=actor.id, actor_role=actor.role,
            event_type="package.processed", resource_type="package", resource_id=package_id,
            description=f"{actor.full_name} marked package as fully processed",
            lab_id=lab_id,
        )
        return self.get_package(package_id, lab_id)

    # ── Activity ──────────────────────────────────────────────────────────────

    def list_activity(self, package_id: str) -> list[dict]:
        result = (
            self.db.table("package_activity_logs")
            .select("*")
            .eq("package_id", package_id)
            .order("created_at")
            .execute()
        )
        return result.data or []

    # ── Internal ──────────────────────────────────────────────────────────────

    def _log_activity(
        self,
        *,
        package_id: str,
        lab_id: str,
        actor: CurrentUser,
        action: str,
        notes: str | None = None,
    ) -> None:
        self.db.table("package_activity_logs").insert({
            "package_id": package_id,
            "lab_id": lab_id,
            "actor_id": actor.id,
            "actor_name": actor.full_name,
            "action": action,
            "notes": notes,
        }).execute()
