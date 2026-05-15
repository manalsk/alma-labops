from typing import Optional
from pydantic import BaseModel


class VerifyExtractionRequest(BaseModel):
    extracted_item_name: Optional[str] = None
    extracted_vendor: Optional[str] = None
    extracted_quantity: Optional[float] = None
    extracted_unit: Optional[str] = None
    extracted_catalog_number: Optional[str] = None
    extracted_category: Optional[str] = None
    extracted_storage_condition: Optional[str] = None
    extraction_notes: Optional[str] = None


class CreateInventoryFromPackageRequest(BaseModel):
    location_id: Optional[str] = None
    category_id: Optional[str] = None
    threshold: int = 0
    reorder_quantity: int = 0
    notes: Optional[str] = None
    # Human can override extracted values before creating
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    catalog_number: Optional[str] = None
    vendor: Optional[str] = None


class CreateTaskFromPackageRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[str] = None
