"""Incoming package service — AI-assisted package intake business logic."""
from supabase import Client


class IncomingPackageService:
    def __init__(self, db: Client) -> None:
        self.db = db

    async def list_packages(self, lab_id: str) -> list[dict]:
        raise NotImplementedError

    async def create_package(self, data: dict, actor_id: str) -> dict:
        raise NotImplementedError

    async def verify_package(self, package_id: str, confirmed_data: dict, actor_id: str) -> dict:
        raise NotImplementedError
