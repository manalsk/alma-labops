"""Purchase request service — procurement workflow business logic."""
from supabase import Client


class PurchaseRequestService:
    def __init__(self, db: Client) -> None:
        self.db = db

    async def list_requests(self, lab_id: str, requester_id: str | None = None) -> list[dict]:
        raise NotImplementedError

    async def create_request(self, data: dict, requester_id: str) -> dict:
        raise NotImplementedError

    async def approve(self, request_id: str, approver_id: str) -> dict:
        raise NotImplementedError

    async def reject(self, request_id: str, approver_id: str, reason: str) -> dict:
        raise NotImplementedError
