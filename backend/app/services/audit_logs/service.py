"""Audit log service — records operational events and AI interactions."""

from typing import Any

from supabase import Client


class AuditLogService:
    def __init__(self, db: Client) -> None:
        self.db = db

    def log_event(
        self,
        *,
        actor_id: str,
        actor_role: str,
        event_type: str,
        resource_type: str,
        description: str,
        lab_id: str,
        resource_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict:
        result = (
            self.db.table("audit_logs")
            .insert(
                {
                    "actor_id": actor_id,
                    "actor_role": actor_role,
                    "event_type": event_type,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "description": description,
                    "metadata": metadata,
                    "lab_id": lab_id,
                }
            )
            .execute()
        )
        return result.data[0]

    def log_ai_interaction(
        self,
        *,
        user_id: str,
        user_role: str,
        prompt: str,
        model_used: str,
        lab_id: str,
        tool_called: str | None = None,
        response_summary: str | None = None,
        status: str = "success",
        package_id: str | None = None,
        tokens_used: int | None = None,
        metadata: dict | None = None,
    ) -> dict:
        result = (
            self.db.table("ai_audit_logs")
            .insert(
                {
                    "user_id": user_id,
                    "user_role": user_role,
                    "prompt": prompt,
                    "tool_called": tool_called,
                    "model_used": model_used,
                    "response_summary": response_summary,
                    "status": status,
                    "lab_id": lab_id,
                    "package_id": package_id,
                    "tokens_used": tokens_used,
                    "metadata": metadata,
                }
            )
            .execute()
        )
        return result.data[0]

    def list_logs(self, *, lab_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
        result = (
            self.db.table("audit_logs")
            .select("*")
            .eq("lab_id", lab_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []

    def list_ai_logs(self, *, lab_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
        result = (
            self.db.table("ai_audit_logs")
            .select("*")
            .eq("lab_id", lab_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []
