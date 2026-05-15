"""Inventory service — all inventory business logic lives here."""

from typing import Any

from supabase import Client

from app.models.auth import CurrentUser
from app.services.audit_logs.service import AuditLogService


def _compute_status(quantity: float, threshold: float) -> str:
    if quantity <= 0:
        return "out_of_stock"
    if threshold > 0 and quantity <= threshold:
        return "low_stock"
    return "in_stock"


class InventoryService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self.audit = AuditLogService(db)

    # ─── Locations ──────────────────────────────────────────────────────────────

    def list_locations(self, lab_id: str) -> list[dict]:
        result = (
            self.db.table("inventory_locations")
            .select("*")
            .eq("lab_id", lab_id)
            .order("name")
            .execute()
        )
        return result.data or []

    # ─── Categories ─────────────────────────────────────────────────────────────

    def list_categories(self, lab_id: str) -> list[dict]:
        result = (
            self.db.table("inventory_categories")
            .select("*")
            .eq("lab_id", lab_id)
            .order("name")
            .execute()
        )
        return result.data or []

    # ─── Items ──────────────────────────────────────────────────────────────────

    def _flatten_item(self, row: dict) -> dict:
        category = row.pop("inventory_categories", None) or {}
        location = row.pop("inventory_locations", None) or {}
        return {
            **row,
            "category_name": category.get("name"),
            "location_name": location.get("name"),
            "status": _compute_status(float(row["quantity"]), float(row["threshold"])),
        }

    def list_items(self, lab_id: str) -> list[dict]:
        result = (
            self.db.table("inventory_items")
            .select("*, inventory_categories(name), inventory_locations(name)")
            .eq("lab_id", lab_id)
            .order("name")
            .execute()
        )
        return [self._flatten_item(row) for row in (result.data or [])]

    def get_item(self, item_id: str, lab_id: str) -> dict | None:
        result = (
            self.db.table("inventory_items")
            .select("*, inventory_categories(name), inventory_locations(name)")
            .eq("id", item_id)
            .eq("lab_id", lab_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        return self._flatten_item(result.data[0])

    def create_item(self, data: dict, actor: CurrentUser) -> dict:
        row = {**data, "lab_id": actor.lab_id, "created_by": actor.id}
        result = self.db.table("inventory_items").insert(row).execute()
        item = result.data[0]

        self._log_activity(
            item_id=item["id"],
            actor=actor,
            action="created",
            new_value={"name": item["name"], "quantity": float(item["quantity"])},
        )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="inventory.created",
            resource_type="inventory_item",
            resource_id=item["id"],
            description=f'{actor.full_name} created inventory item "{item["name"]}"',
            lab_id=actor.lab_id,
        )
        return self.get_item(item["id"], actor.lab_id)

    def update_item(self, item_id: str, data: dict, actor: CurrentUser) -> dict | None:
        if not data:
            return self.get_item(item_id, actor.lab_id)

        old = self.get_item(item_id, actor.lab_id)
        self.db.table("inventory_items").update(data).eq("id", item_id).eq("lab_id", actor.lab_id).execute()

        location_changed = (
            "location_id" in data
            and old is not None
            and data["location_id"] != old.get("location_id")
        )
        action = "location_changed" if location_changed else "updated"
        self._log_activity(
            item_id=item_id,
            actor=actor,
            action=action,
            old_value={k: old.get(k) for k in data} if old else None,
            new_value=data,
        )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type=f"inventory.{action}",
            resource_type="inventory_item",
            resource_id=item_id,
            description=f'{actor.full_name} updated inventory item "{old["name"] if old else item_id}"',
            lab_id=actor.lab_id,
            metadata={"fields_changed": list(data.keys())},
        )
        return self.get_item(item_id, actor.lab_id)

    def update_quantity(
        self, item_id: str, quantity: float, actor: CurrentUser, notes: str | None = None
    ) -> dict | None:
        old = self.get_item(item_id, actor.lab_id)
        if not old:
            return None

        self.db.table("inventory_items").update({"quantity": quantity}).eq("id", item_id).eq("lab_id", actor.lab_id).execute()

        self._log_activity(
            item_id=item_id,
            actor=actor,
            action="quantity_updated",
            old_value={"quantity": old["quantity"]},
            new_value={"quantity": quantity},
            notes=notes,
        )
        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="inventory.quantity_updated",
            resource_type="inventory_item",
            resource_id=item_id,
            description=(
                f'{actor.full_name} updated quantity of "{old["name"]}" '
                f'from {old["quantity"]} to {quantity} {old["unit"]}'
            ),
            lab_id=actor.lab_id,
        )
        return self.get_item(item_id, actor.lab_id)

    def delete_item(self, item_id: str, actor: CurrentUser) -> None:
        item = self.get_item(item_id, actor.lab_id)
        if not item:
            return

        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="inventory.deleted",
            resource_type="inventory_item",
            resource_id=item_id,
            description=f'{actor.full_name} deleted inventory item "{item["name"]}"',
            lab_id=actor.lab_id,
        )
        # Activity logs cascade-delete with the item
        self.db.table("inventory_items").delete().eq("id", item_id).eq("lab_id", actor.lab_id).execute()

    # ─── Activity Logs ──────────────────────────────────────────────────────────

    def list_activity(self, item_id: str, lab_id: str) -> list[dict]:
        result = (
            self.db.table("inventory_activity_logs")
            .select("*")
            .eq("item_id", item_id)
            .eq("lab_id", lab_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return result.data or []

    def _log_activity(
        self,
        *,
        item_id: str,
        actor: CurrentUser,
        action: str,
        old_value: dict[str, Any] | None = None,
        new_value: dict[str, Any] | None = None,
        notes: str | None = None,
    ) -> None:
        self.db.table("inventory_activity_logs").insert(
            {
                "item_id": item_id,
                "actor_id": actor.id,
                "actor_name": actor.full_name,
                "action": action,
                "old_value": old_value,
                "new_value": new_value,
                "notes": notes,
                "lab_id": actor.lab_id,
            }
        ).execute()
