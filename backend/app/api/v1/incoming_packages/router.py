from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_packages():
    """List incoming packages for the authenticated user's lab. Implemented in Phase 2."""
    return {"message": "incoming package endpoints coming in Phase 2"}
