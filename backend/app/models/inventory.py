from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class LocationResponse(BaseModel):
    id: str
    lab_id: str
    name: str
    description: Optional[str] = None
    created_at: datetime


class CategoryResponse(BaseModel):
    id: str
    lab_id: str
    name: str
    color: Optional[str] = None
    created_at: datetime


class InventoryItemResponse(BaseModel):
    id: str
    lab_id: str
    name: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    quantity: float
    unit: str
    threshold: float
    reorder_quantity: float
    status: str  # in_stock | low_stock | out_of_stock
    notes: Optional[str] = None
    catalog_number: Optional[str] = None
    vendor: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ActivityLogResponse(BaseModel):
    id: str
    item_id: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    action: str
    old_value: Optional[dict[str, Any]] = None
    new_value: Optional[dict[str, Any]] = None
    notes: Optional[str] = None
    created_at: datetime


class CreateItemRequest(BaseModel):
    name: str
    category_id: Optional[str] = None
    location_id: Optional[str] = None
    quantity: float = Field(default=0, ge=0)
    unit: str = "units"
    threshold: float = Field(default=0, ge=0)
    reorder_quantity: float = Field(default=0, ge=0)
    notes: Optional[str] = None
    catalog_number: Optional[str] = None
    vendor: Optional[str] = None


class UpdateItemRequest(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    location_id: Optional[str] = None
    unit: Optional[str] = None
    threshold: Optional[float] = Field(default=None, ge=0)
    reorder_quantity: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None
    catalog_number: Optional[str] = None
    vendor: Optional[str] = None


class UpdateQuantityRequest(BaseModel):
    quantity: float = Field(ge=0)
    notes: Optional[str] = None
