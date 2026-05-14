from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from app.db.supabase import get_supabase_client

bearer = HTTPBearer()


async def get_db() -> Client:
    return get_supabase_client()


async def get_current_user_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> str:
    """Extract and return the raw JWT from the Authorization header."""
    return credentials.credentials


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Client = Depends(get_db),
) -> dict:
    """Validate JWT and return the authenticated user payload."""
    token = credentials.credentials
    try:
        response = db.auth.get_user(token)
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        return {"user": response.user, "token": token}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from exc
