"""Audit log service — operational event recording."""
from supabase import Client


class AuditLogService:
    def __init__(self, db: Client) -> None:
        self.db = db

    async def log_event(
        self,
        actor_id: str,
        event_type: str,
        resource_type: str,
        description: str,
        lab_id: str,
        resource_id: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        raise NotImplementedError

    async def list_logs(self, lab_id: str, limit: int = 50) -> list[dict]:
        raise NotImplementedError
