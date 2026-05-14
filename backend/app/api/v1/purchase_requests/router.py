from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_purchase_requests():
    """List purchase requests for the authenticated user's lab. Implemented in Phase 2."""
    return {"message": "purchase request endpoints coming in Phase 2"}
