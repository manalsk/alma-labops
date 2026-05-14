"""Task service — operational task coordination business logic."""
from supabase import Client


class TaskService:
    def __init__(self, db: Client) -> None:
        self.db = db

    async def list_tasks(self, lab_id: str, assigned_to: str | None = None) -> list[dict]:
        raise NotImplementedError

    async def create_task(self, data: dict, creator_id: str) -> dict:
        raise NotImplementedError

    async def update_status(self, task_id: str, status: str, actor_id: str) -> dict:
        raise NotImplementedError
