from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_tasks():
    """List tasks for the authenticated user's lab. Implemented in Phase 2."""
    return {"message": "task endpoints coming in Phase 2"}
