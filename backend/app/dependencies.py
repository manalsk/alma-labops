import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from app.db.supabase import get_supabase_client
from app.middleware.rbac import require_permission as check_permission
from app.models.auth import CurrentUser

logger = logging.getLogger(__name__)

bearer = HTTPBearer()


async def get_db() -> Client:
    return get_supabase_client()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Client = Depends(get_db),
) -> CurrentUser:
    """Validate the Supabase JWT and return the authenticated user with profile."""
    token = credentials.credentials
    try:
        user_response = db.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        user_id = str(user_response.user.id)

        profile_resp = (
            db.table("profiles")
            .select("*, user_permissions!user_permissions_user_id_fkey(permission_name)")
            .eq("id", user_id)
            .single()
            .execute()
        )

        if not profile_resp.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User profile not found — account may not be set up",
            )

        profile = profile_resp.data
        if not profile.get("is_active"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )

        extra_permissions = [
            p["permission_name"] for p in (profile.get("user_permissions") or [])
        ]

        return CurrentUser(
            id=user_id,
            email=user_response.user.email or "",
            role=profile["role"],
            lab_id=profile["lab_id"],
            org_id=profile["org_id"],
            full_name=profile["full_name"],
            permissions=extra_permissions,
            is_active=profile["is_active"],
            created_at=profile["created_at"],
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Authentication error: %s: %s", type(exc).__name__, exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        ) from exc


def require_permission(permission: str):
    """FastAPI dependency factory — injects current user and enforces a permission."""

    async def dependency(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        check_permission(current_user.role, permission, current_user.permissions)
        return current_user

    return Depends(dependency)
