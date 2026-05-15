"""Operational Copilot API — RBAC-aware operational Q&A."""

import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies import get_current_user, get_db
from app.models.auth import CurrentUser
from app.services.copilot.service import CopilotService
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()


def _svc(db: Client = Depends(get_db)) -> CopilotService:
    return CopilotService(db)


class AskRequest(BaseModel):
    question: str


@router.post("/ask")
async def ask_copilot(
    body: AskRequest,
    current_user: CurrentUser = Depends(get_current_user),
    svc: CopilotService = Depends(_svc),
):
    if not body.question.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="question cannot be empty",
        )
    try:
        result = await svc.ask(question=body.question, user=current_user)
    except Exception as exc:
        logger.error("Copilot ask failed:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Copilot query failed: {type(exc).__name__}: {exc}",
        ) from exc

    return result
