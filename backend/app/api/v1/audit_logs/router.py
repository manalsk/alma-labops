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
    event_type: str | None = Query(None),
    actor_role: str | None = Query(None),
    resource_type: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    search: str | None = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """List operational audit log entries with optional filters."""
    service = AuditLogService(db)
    logs = service.list_logs(
        lab_id=current_user.lab_id,
        limit=limit,
        offset=offset,
        event_type=event_type,
        actor_role=actor_role,
        resource_type=resource_type,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )
    return {"data": logs, "total": len(logs)}


@router.get("/ai")
async def list_ai_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tool_called: str | None = Query(None),
    status: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """List AI interaction audit log entries with optional filters."""
    service = AuditLogService(db)
    logs = service.list_ai_logs(
        lab_id=current_user.lab_id,
        limit=limit,
        offset=offset,
        tool_called=tool_called,
        status=status,
        start_date=start_date,
        end_date=end_date,
    )
    return {"data": logs, "total": len(logs)}
