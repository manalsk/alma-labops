"""Knowledge base service — document management and RAG retrieval business logic."""
from supabase import Client


class KnowledgeBaseService:
    def __init__(self, db: Client) -> None:
        self.db = db

    async def list_documents(self, lab_id: str) -> list[dict]:
        raise NotImplementedError

    async def upload_document(self, file_bytes: bytes, metadata: dict, actor_id: str) -> dict:
        raise NotImplementedError

    async def semantic_search(self, query: str, lab_id: str, limit: int = 5) -> list[dict]:
        raise NotImplementedError
