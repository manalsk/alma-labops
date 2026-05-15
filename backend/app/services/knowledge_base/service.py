"""Knowledge base service — document management, chunking, and RAG retrieval."""
import re
import uuid as _uuid

from supabase import Client

from app.models.auth import CurrentUser
from app.services.audit_logs.service import AuditLogService
from app.ai.rag_assistant import VISIBILITY_BY_ROLE


def _chunk_markdown(text: str, max_chars: int = 800, min_chars: int = 80) -> list[str]:
    """
    Split markdown text into chunks at paragraph boundaries.
    Merges chunks that are too short into the previous one.
    """
    # Split on blank lines
    raw = re.split(r"\n{2,}", text.strip())
    chunks: list[str] = []
    current = ""

    for block in raw:
        block = block.strip()
        if not block:
            continue
        if not current:
            current = block
        elif len(current) + len(block) + 2 <= max_chars:
            current += "\n\n" + block
        else:
            if len(current) >= min_chars:
                chunks.append(current)
            else:
                # too short — merge into next block
                block = current + "\n\n" + block
            current = block

    if current and len(current) >= min_chars:
        chunks.append(current)
    elif current and chunks:
        chunks[-1] += "\n\n" + current  # append to last chunk

    return chunks or [text.strip()]


class KnowledgeBaseService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self.audit = AuditLogService(db)

    # ── Documents ─────────────────────────────────────────────────────────────

    def list_documents(self, lab_id: str, user_role: str) -> list[dict]:
        """Return documents the current role is permitted to see."""
        visible = VISIBILITY_BY_ROLE.get(user_role, ["all_lab_members"])
        result = (
            self.db.table("kb_documents")
            .select("*")
            .eq("lab_id", lab_id)
            .in_("visibility", visible)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    def get_document(self, doc_id: str, lab_id: str) -> dict | None:
        result = (
            self.db.table("kb_documents")
            .select("*")
            .eq("id", doc_id)
            .eq("lab_id", lab_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def create_document_record(
        self,
        *,
        lab_id: str,
        title: str,
        category: str,
        file_url: str,
        file_path: str,
        file_type: str,
        visibility: str,
        actor: CurrentUser,
    ) -> dict:
        row = {
            "lab_id":           lab_id,
            "title":            title,
            "category":         category,
            "file_url":         file_url,
            "file_path":        file_path,
            "file_type":        file_type,
            "visibility":       visibility,
            "uploaded_by":      actor.id,
            "uploaded_by_name": actor.full_name,
            "is_indexed":       False,
            "chunk_count":      0,
        }
        result = self.db.table("kb_documents").insert(row).execute()
        doc = result.data[0]
        self.audit.log_event(
            actor_id=actor.id, actor_role=actor.role,
            event_type="kb.document_uploaded",
            resource_type="kb_document", resource_id=doc["id"],
            description=f'{actor.full_name} uploaded KB document "{title}"',
            lab_id=lab_id,
        )
        return doc

    def delete_document(self, doc_id: str, lab_id: str, actor: CurrentUser) -> None:
        doc = self.get_document(doc_id, lab_id)
        if not doc:
            return
        # Chunks deleted by CASCADE
        self.db.table("kb_documents").delete().eq("id", doc_id).eq("lab_id", lab_id).execute()
        self.audit.log_event(
            actor_id=actor.id, actor_role=actor.role,
            event_type="kb.document_deleted",
            resource_type="kb_document", resource_id=doc_id,
            description=f'{actor.full_name} deleted KB document "{doc.get("title")}"',
            lab_id=lab_id,
        )

    # ── Storage ───────────────────────────────────────────────────────────────

    def upload_to_storage(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        lab_id: str,
    ) -> tuple[str, str]:
        """Upload to Supabase Storage. Returns (path, signed_url)."""
        doc_id = str(_uuid.uuid4())
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "md"
        path = f"lab/{lab_id}/{doc_id}.{ext}"
        self.db.storage.from_("kb-documents").upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type},
        )
        signed = self.db.storage.from_("kb-documents").create_signed_url(path, expires_in=31536000)
        signed_url = signed.get("signedURL") or signed.get("signed_url") or ""
        return path, signed_url

    # ── Ingestion ─────────────────────────────────────────────────────────────

    def store_chunks(
        self,
        doc_id: str,
        lab_id: str,
        chunks: list[tuple[str, list[float]]],  # (text, embedding)
    ) -> None:
        """Batch-insert chunks with embeddings, then mark document as indexed."""
        # Delete existing chunks first (supports re-indexing)
        self.db.table("document_chunks").delete().eq("document_id", doc_id).execute()

        rows = [
            {
                "document_id": doc_id,
                "lab_id":      lab_id,
                "content":     text,
                "chunk_index": i,
                "embedding":   embedding,
            }
            for i, (text, embedding) in enumerate(chunks)
        ]
        if rows:
            self.db.table("document_chunks").insert(rows).execute()

        self.db.table("kb_documents").update({
            "is_indexed":  True,
            "chunk_count": len(chunks),
        }).eq("id", doc_id).execute()

    def mark_indexing_failed(self, doc_id: str) -> None:
        self.db.table("kb_documents").update({
            "is_indexed":  False,
            "chunk_count": 0,
        }).eq("id", doc_id).execute()

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def search_chunks(
        self,
        query_embedding: list[float],
        lab_id: str,
        user_role: str,
        top_k: int = 5,
        threshold: float = 0.25,
    ) -> list[dict]:
        """RBAC-aware semantic search via pgvector RPC."""
        visibility = VISIBILITY_BY_ROLE.get(user_role, ["all_lab_members"])
        result = self.db.rpc(
            "search_kb_chunks",
            {
                "query_embedding": query_embedding,
                "p_lab_id":        lab_id,
                "p_visibility":    visibility,
                "p_top_k":         top_k,
                "p_threshold":     threshold,
            },
        ).execute()
        return result.data or []

    # ── RAG Query Log ─────────────────────────────────────────────────────────

    def log_rag_query(
        self,
        *,
        lab_id: str,
        user_id: str,
        user_role: str,
        question: str,
        answer: str | None,
        sources: list[dict],
        was_refused: bool,
        model_used: str,
        tokens_used: int | None,
    ) -> dict:
        row = {
            "lab_id":      lab_id,
            "user_id":     user_id,
            "user_role":   user_role,
            "question":    question,
            "answer":      answer,
            "sources":     sources,
            "was_refused": was_refused,
            "model_used":  model_used,
            "tokens_used": tokens_used,
        }
        result = self.db.table("rag_queries").insert(row).execute()
        return result.data[0]

    def list_rag_queries(self, lab_id: str, limit: int = 20) -> list[dict]:
        result = (
            self.db.table("rag_queries")
            .select("*")
            .eq("lab_id", lab_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    # ── Chunk utils (exposed for router use) ──────────────────────────────────

    @staticmethod
    def chunk_text(text: str) -> list[str]:
        return _chunk_markdown(text)
