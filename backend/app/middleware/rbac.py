"""RBAC middleware — enforces role and permission checks at the API layer."""
from fastapi import HTTPException, status

ROLE_BASE_PERMISSIONS: dict[str, list[str]] = {
    "pi": [
        "manage_users",
        "manage_vendors",
        "upload_kb_docs",
        "assign_tasks",
        "approve_purchase_request",
        "view_financial_summary",
        "manage_locations",
        "manage_inventory",
        "manage_categories",
        "assign_permissions",
    ],
    "researcher": ["assign_tasks", "manage_inventory"],
    "student": [],
}


def require_permission(user_role: str, permission: str, extra_permissions: list[str] | None = None) -> None:
    """Raise 403 if the user does not hold the required permission."""
    allowed = ROLE_BASE_PERMISSIONS.get(user_role, [])
    granted = (extra_permissions or [])

    if permission not in allowed and permission not in granted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' required",
        )


def has_permission(user_role: str, permission: str, extra_permissions: list[str] | None = None) -> bool:
    """Return True if the user holds the required permission."""
    allowed = ROLE_BASE_PERMISSIONS.get(user_role, [])
    granted = (extra_permissions or [])
    return permission in allowed or permission in granted
