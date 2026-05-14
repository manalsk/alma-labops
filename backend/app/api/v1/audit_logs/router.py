from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_audit_logs():
    """List audit log entries for the authenticated user's lab. Implemented in Phase 2."""
    return {"message": "audit log endpoints coming in Phase 2"}
