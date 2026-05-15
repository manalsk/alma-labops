from typing import Optional
from pydantic import BaseModel


class CreateTaskRequest(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    task_type: str = "operational"
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    related_inventory_item_id: Optional[str] = None
    related_purchase_request_id: Optional[str] = None


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    task_type: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    related_inventory_item_id: Optional[str] = None
    related_purchase_request_id: Optional[str] = None


class UpdateTaskStatusRequest(BaseModel):
    status: str
