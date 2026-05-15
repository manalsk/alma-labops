from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies import get_current_user, get_db, require_permission
from app.models.auth import CurrentUser, ProfileResponse
from supabase import Client

router = APIRouter()

# Permissions that the PI may delegate to researchers
DELEGATABLE_PERMISSIONS = {"view_audit_logs"}


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


@router.get("/members")
async def list_members(
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """Return all active lab members with their delegated permissions."""
    result = (
        db.table("profiles")
        .select("id, full_name, role, user_permissions!user_permissions_user_id_fkey(permission_name)")
        .eq("lab_id", current_user.lab_id)
        .eq("is_active", True)
        .order("full_name")
        .execute()
    )
    members = []
    for row in (result.data or []):
        perms = [p["permission_name"] for p in (row.get("user_permissions") or [])]
        members.append({
            "id": row["id"],
            "full_name": row["full_name"],
            "role": row["role"],
            "permissions": perms,
        })
    return {"data": members}


class GrantPermissionBody(BaseModel):
    permission_name: str


@router.post("/members/{user_id}/permissions", status_code=status.HTTP_201_CREATED)
async def grant_permission(
    user_id: str,
    body: GrantPermissionBody,
    current_user: CurrentUser = require_permission("assign_permissions"),
    db: Client = Depends(get_db),
):
    """Grant a delegatable permission to a lab member (PI only)."""
    if body.permission_name not in DELEGATABLE_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{body.permission_name}' is not a delegatable permission",
        )

    # Verify the target user belongs to the same lab
    target = (
        db.table("profiles")
        .select("id, lab_id, role")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not target.data or target.data["lab_id"] != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if target.data["role"] == "pi":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delegate permissions to another PI",
        )

    db.table("user_permissions").upsert({
        "user_id": user_id,
        "permission_name": body.permission_name,
        "granted_by": current_user.id,
    }, on_conflict="user_id,permission_name").execute()

    return {"user_id": user_id, "permission_name": body.permission_name, "granted": True}


@router.delete("/members/{user_id}/permissions/{permission_name}", status_code=status.HTTP_200_OK)
async def revoke_permission(
    user_id: str,
    permission_name: str,
    current_user: CurrentUser = require_permission("assign_permissions"),
    db: Client = Depends(get_db),
):
    """Revoke a delegated permission from a lab member (PI only)."""
    if permission_name not in DELEGATABLE_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{permission_name}' is not a delegatable permission",
        )

    # Verify the target user belongs to the same lab
    target = (
        db.table("profiles")
        .select("id, lab_id")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not target.data or target.data["lab_id"] != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    db.table("user_permissions").delete().eq("user_id", user_id).eq("permission_name", permission_name).execute()

    return {"user_id": user_id, "permission_name": permission_name, "revoked": True}
