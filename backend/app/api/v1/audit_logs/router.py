from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user, get_db
from app.models.auth import CurrentUser
from app.services.audit_logs.service import AuditLogService
from supabase import Client

router = APIRouter()


@router.get("/")
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """List operational audit log entries for the user's lab."""
    service = AuditLogService(db)
    logs = service.list_logs(lab_id=current_user.lab_id, limit=limit, offset=offset)
    return {"data": logs, "total": len(logs)}


@router.get("/ai")
async def list_ai_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """List AI interaction audit log entries for the user's lab."""
    service = AuditLogService(db)
    logs = service.list_ai_logs(lab_id=current_user.lab_id, limit=limit, offset=offset)
    return {"data": logs, "total": len(logs)}
