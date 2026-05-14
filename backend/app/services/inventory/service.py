"""Inventory service — all inventory business logic lives here."""
from supabase import Client


class InventoryService:
    def __init__(self, db: Client) -> None:
        self.db = db

    async def list_items(self, lab_id: str) -> list[dict]:
        raise NotImplementedError

    async def get_item(self, item_id: str) -> dict:
        raise NotImplementedError

    async def create_item(self, data: dict, actor_id: str) -> dict:
        raise NotImplementedError

    async def update_item(self, item_id: str, data: dict, actor_id: str) -> dict:
        raise NotImplementedError

    async def delete_item(self, item_id: str, actor_id: str) -> None:
        raise NotImplementedError
