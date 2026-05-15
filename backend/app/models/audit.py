from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    actor_id: str | None
    actor_role: str | None
    event_type: str
    resource_type: str
    resource_id: str | None
    description: str
    metadata: dict[str, Any] | None
    lab_id: str | None
    created_at: datetime


class AIAuditLogResponse(BaseModel):
    id: str
    user_id: str | None
    user_role: str | None
    prompt: str
    tool_called: str | None
    model_used: str
    response_summary: str | None
    status: str
    lab_id: str | None
    created_at: datetime
