from typing import List, Optional

from pydantic import BaseModel, Field


class PurchaseRequestItemIn(BaseModel):
    item_name: str
    quantity: float = Field(default=1, gt=0)
    unit: str = "units"
    catalog_number: Optional[str] = None
    vendor: Optional[str] = None
    estimated_unit_price: Optional[float] = Field(default=None, ge=0)
    inventory_item_id: Optional[str] = None
    notes: Optional[str] = None


class CreatePurchaseRequestRequest(BaseModel):
    title: str
    description: Optional[str] = None
    urgency: str = "normal"
    vendor_id: Optional[str] = None
    notes: Optional[str] = None
    submit: bool = False  # True → skip draft, go straight to pending_approval
    items: List[PurchaseRequestItemIn] = Field(default_factory=list)


class UpdatePurchaseRequestRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    urgency: Optional[str] = None
    vendor_id: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[PurchaseRequestItemIn]] = None  # None = leave items unchanged


class ActionNoteRequest(BaseModel):
    notes: Optional[str] = None


class ClarificationRequest(BaseModel):
    note: str
