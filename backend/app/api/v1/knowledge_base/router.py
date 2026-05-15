"""Knowledge Base API — document upload + ingestion + constrained RAG."""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.dependencies import get_current_user, get_db, require_permission
from app.models.auth import CurrentUser
from app.services.knowledge_base.service import KnowledgeBaseService
from app.ai.rag_assistant import generate_embedding, answer_question
from supabase import Client

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
VALID_VISIBILITY = {"all_lab_members", "researchers_only", "pi_only"}


def _svc(db: Client = Depends(get_db)) -> KnowledgeBaseService:
    return KnowledgeBaseService(db)


def _get_or_404(svc: KnowledgeBaseService, doc_id: str, lab_id: str) -> dict:
    doc = svc.get_document(doc_id, lab_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_documents(
    current_user: CurrentUser = Depends(get_current_user),
    svc: KnowledgeBaseService = Depends(_svc),
):
    docs = svc.list_documents(lab_id=current_user.lab_id, user_role=current_user.role)
    return {"data": docs, "total": len(docs)}


# ── RAG Ask (static path — must precede /{doc_id}) ───────────────────────────

class AskRequest(BaseModel):
    question: str
    top_k: int = 5


@router.post("/ask")
async def ask_question(
    body: AskRequest,
    current_user: CurrentUser = Depends(get_current_user),
    svc: KnowledgeBaseService = Depends(_svc),
):
    if not body.question.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="question cannot be empty",
        )

    try:
        query_embedding = await generate_embedding(body.question)
        chunks = svc.search_chunks(
            query_embedding=query_embedding,
            lab_id=current_user.lab_id,
            user_role=current_user.role,
            top_k=max(1, min(body.top_k, 10)),
        )
        result = await answer_question(question=body.question, retrieved_chunks=chunks)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"RAG query failed: {exc}",
        ) from exc

    log = svc.log_rag_query(
        lab_id=current_user.lab_id,
        user_id=current_user.id,
        user_role=current_user.role,
        question=body.question,
        answer=result["answer"],
        sources=result["sources"],
        was_refused=result["was_refused"],
        model_used="gpt-4.1-mini",
        tokens_used=result.get("tokens_used"),
    )

    return {
        "answer":      result["answer"],
        "was_refused": result["was_refused"],
        "sources":     result["sources"],
        "tokens_used": result.get("tokens_used"),
        "query_id":    log["id"],
    }


# ── RAG Query History (static path — must precede /{doc_id}) ─────────────────

@router.get("/queries")
async def list_rag_queries(
    limit: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    svc: KnowledgeBaseService = Depends(_svc),
):
    queries = svc.list_rag_queries(lab_id=current_user.lab_id, limit=limit)
    return {"data": queries}


# ── Upload + Ingest ───────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Query(..., description="Document title"),
    category: str = Query("general"),
    visibility: str = Query("all_lab_members"),
    current_user: CurrentUser = require_permission("upload_kb_docs"),
    svc: KnowledgeBaseService = Depends(_svc),
):
    if visibility not in VALID_VISIBILITY:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"visibility must be one of: {', '.join(sorted(VALID_VISIBILITY))}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 5 MB limit",
        )

    content_type = file.content_type or "text/plain"

    try:
        path, signed_url = svc.upload_to_storage(
            file_bytes=file_bytes,
            filename=file.filename or "document.md",
            content_type=content_type,
            lab_id=current_user.lab_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage upload failed: {exc}",
        ) from exc

    doc = svc.create_document_record(
        lab_id=current_user.lab_id,
        title=title,
        category=category,
        file_url=signed_url,
        file_path=path,
        file_type=content_type,
        visibility=visibility,
        actor=current_user,
    )

    # Ingest immediately — embedding failure is non-fatal
    try:
        text = file_bytes.decode("utf-8", errors="replace")
        chunks = svc.chunk_text(text)
        chunk_pairs = [(chunk, await generate_embedding(chunk)) for chunk in chunks]
        svc.store_chunks(doc_id=doc["id"], lab_id=current_user.lab_id, chunks=chunk_pairs)
        doc = svc.get_document(doc["id"], current_user.lab_id) or doc
    except Exception:
        svc.mark_indexing_failed(doc["id"])
        doc = svc.get_document(doc["id"], current_user.lab_id) or doc

    return {"data": doc}


# ── Get single ────────────────────────────────────────────────────────────────

@router.get("/{doc_id}")
async def get_document(
    doc_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: KnowledgeBaseService = Depends(_svc),
):
    return {"data": _get_or_404(svc, doc_id, current_user.lab_id)}


# ── Re-ingest ─────────────────────────────────────────────────────────────────

@router.post("/{doc_id}/ingest")
async def reingest_document(
    doc_id: str,
    current_user: CurrentUser = require_permission("upload_kb_docs"),
    svc: KnowledgeBaseService = Depends(_svc),
):
    doc = _get_or_404(svc, doc_id, current_user.lab_id)
    try:
        file_bytes = svc.db.storage.from_("kb-documents").download(doc["file_path"])
        text = file_bytes.decode("utf-8", errors="replace")
        chunks = svc.chunk_text(text)
        chunk_pairs = [(chunk, await generate_embedding(chunk)) for chunk in chunks]
        svc.store_chunks(doc_id=doc_id, lab_id=current_user.lab_id, chunks=chunk_pairs)
    except Exception as exc:
        svc.mark_indexing_failed(doc_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ingestion failed: {exc}",
        ) from exc

    return {"data": svc.get_document(doc_id, current_user.lab_id)}


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: KnowledgeBaseService = Depends(_svc),
):
    if current_user.role != "pi":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the PI can delete knowledge base documents",
        )
    _get_or_404(svc, doc_id, current_user.lab_id)
    svc.delete_document(doc_id, current_user.lab_id, current_user)
