"""Task service — operational task coordination business logic."""

import datetime

from supabase import Client

from app.models.auth import CurrentUser
from app.services.audit_logs.service import AuditLogService


class TaskService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self.audit = AuditLogService(db)

    # ── Queries ───────────────────────────────────────────────────────────────

    def list_tasks(
        self,
        lab_id: str,
        status: str | None = None,
        priority: str | None = None,
        task_type: str | None = None,
        assigned_to: str | None = None,
    ) -> list[dict]:
        q = (
            self.db.table("tasks")
            .select("*")
            .eq("lab_id", lab_id)
            .order("created_at", desc=True)
        )
        if status:
            q = q.eq("status", status)
        if priority:
            q = q.eq("priority", priority)
        if task_type:
            q = q.eq("task_type", task_type)
        if assigned_to:
            q = q.eq("assigned_to", assigned_to)
        return q.execute().data or []

    def get_task(self, task_id: str, lab_id: str) -> dict | None:
        result = (
            self.db.table("tasks")
            .select("*")
            .eq("id", task_id)
            .eq("lab_id", lab_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def _get_member_name(self, user_id: str | None, lab_id: str) -> str | None:
        if not user_id:
            return None
        result = (
            self.db.table("profiles")
            .select("full_name")
            .eq("id", user_id)
            .eq("lab_id", lab_id)
            .limit(1)
            .execute()
        )
        return result.data[0]["full_name"] if result.data else None

    # ── Mutations ─────────────────────────────────────────────────────────────

    def create_task(self, data: dict, actor: CurrentUser) -> dict | None:
        assigned_to = data.get("assigned_to")
        assigned_to_name = self._get_member_name(assigned_to, actor.lab_id) if assigned_to else None

        row = {
            **data,
            "lab_id": actor.lab_id,
            "org_id": actor.org_id,
            "created_by": actor.id,
            "created_by_name": actor.full_name,
            "assigned_to": assigned_to,
            "assigned_to_name": assigned_to_name,
            "status": "todo",
        }
        result = self.db.table("tasks").insert(row).execute()
        task = result.data[0]
        task_id = task["id"]

        self._log_activity(task_id=task_id, lab_id=actor.lab_id, actor=actor, action="created", new_value="todo")
        if assigned_to:
            self._log_activity(task_id=task_id, lab_id=actor.lab_id, actor=actor, action="assigned", new_value=assigned_to_name)

        self.audit.log_event(
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="task.created",
            resource_type="task",
            resource_id=task_id,
            description=f'{actor.full_name} created task "{task["title"]}"',
            lab_id=actor.lab_id,
        )
        return self.get_task(task_id, actor.lab_id)

    def update_task(self, task_id: str, data: dict, actor: CurrentUser) -> dict | None:
        old = self.get_task(task_id, actor.lab_id)
        if not old:
            return None

        if "assigned_to" in data:
            assigned_to = data.get("assigned_to")
            data["assigned_to_name"] = self._get_member_name(assigned_to, actor.lab_id) if assigned_to else None

        self.db.table("tasks").update(data).eq("id", task_id).eq("lab_id", actor.lab_id).execute()

        if "assigned_to" in data and data["assigned_to"] != old.get("assigned_to"):
            self._log_activity(
                task_id=task_id, lab_id=actor.lab_id, actor=actor,
                action="assigned",
                old_value=old.get("assigned_to_name"),
                new_value=data.get("assigned_to_name"),
            )
            self.audit.log_event(
                actor_id=actor.id, actor_role=actor.role,
                event_type="task.assigned", resource_type="task", resource_id=task_id,
                description=f'{actor.full_name} assigned task to {data.get("assigned_to_name") or "nobody"}',
                lab_id=actor.lab_id,
            )
        else:
            self._log_activity(task_id=task_id, lab_id=actor.lab_id, actor=actor, action="edited")

        return self.get_task(task_id, actor.lab_id)

    def update_status(self, task_id: str, new_status: str, actor: CurrentUser) -> dict | None:
        old = self.get_task(task_id, actor.lab_id)
        if not old:
            return None
        old_status = old["status"]

        patch: dict = {"status": new_status}
        if new_status == "completed":
            patch["completed_at"] = datetime.datetime.utcnow().isoformat()
        elif old_status == "completed":
            patch["completed_at"] = None

        self.db.table("tasks").update(patch).eq("id", task_id).eq("lab_id", actor.lab_id).execute()

        action = "completed" if new_status == "completed" else "status_changed"
        self._log_activity(
            task_id=task_id, lab_id=actor.lab_id, actor=actor,
            action=action, old_value=old_status, new_value=new_status,
        )
        self.audit.log_event(
            actor_id=actor.id, actor_role=actor.role,
            event_type="task.status_changed", resource_type="task", resource_id=task_id,
            description=f"{actor.full_name} changed task status from {old_status} to {new_status}",
            lab_id=actor.lab_id,
            metadata={"old_status": old_status, "new_status": new_status},
        )
        return self.get_task(task_id, actor.lab_id)

    def delete_task(self, task_id: str, actor: CurrentUser) -> None:
        task = self.get_task(task_id, actor.lab_id)
        if not task:
            return
        self.audit.log_event(
            actor_id=actor.id, actor_role=actor.role,
            event_type="task.deleted", resource_type="task", resource_id=task_id,
            description=f'{actor.full_name} deleted task "{task["title"]}"',
            lab_id=actor.lab_id,
        )
        self.db.table("tasks").delete().eq("id", task_id).eq("lab_id", actor.lab_id).execute()

    def list_activity(self, task_id: str) -> list[dict]:
        result = (
            self.db.table("task_activity_logs")
            .select("*")
            .eq("task_id", task_id)
            .order("created_at")
            .execute()
        )
        return result.data or []

    # ── Internal ──────────────────────────────────────────────────────────────

    def _log_activity(
        self,
        *,
        task_id: str,
        lab_id: str,
        actor: CurrentUser,
        action: str,
        old_value: str | None = None,
        new_value: str | None = None,
        notes: str | None = None,
    ) -> None:
        self.db.table("task_activity_logs").insert({
            "task_id": task_id,
            "lab_id": lab_id,
            "actor_id": actor.id,
            "actor_name": actor.full_name,
            "action": action,
            "old_value": old_value,
            "new_value": new_value,
            "notes": notes,
        }).execute()
