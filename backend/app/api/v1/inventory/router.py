from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_inventory():
    """List all inventory items for the authenticated user's lab. Implemented in Phase 2."""
    return {"message": "inventory endpoints coming in Phase 2"}
