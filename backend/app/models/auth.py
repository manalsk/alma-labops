from datetime import datetime

from pydantic import BaseModel


class CurrentUser(BaseModel):
    id: str
    email: str
    role: str
    lab_id: str
    org_id: str
    full_name: str
    permissions: list[str]
    is_active: bool
    created_at: datetime


class ProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    permissions: list[str]
    lab_id: str
    org_id: str
    is_active: bool
    created_at: datetime
