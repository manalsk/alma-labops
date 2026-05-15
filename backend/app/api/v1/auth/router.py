from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.auth import CurrentUser, ProfileResponse

router = APIRouter()


@router.get("/me", response_model=ProfileResponse)
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """Return the authenticated user's profile and permissions."""
    return ProfileResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        permissions=current_user.permissions,
        lab_id=current_user.lab_id,
        org_id=current_user.org_id,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )
