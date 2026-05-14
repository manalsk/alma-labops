from fastapi import APIRouter

router = APIRouter()


@router.get("/me")
async def get_current_user():
    """Return the currently authenticated user's profile. Implemented in Phase 2."""
    return {"message": "auth endpoints coming in Phase 2"}
