from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user, get_db, require_permission
from app.models.auth import CurrentUser
from app.models.inventory import CreateItemRequest, UpdateItemRequest, UpdateQuantityRequest
from app.services.inventory.service import InventoryService
from supabase import Client

router = APIRouter()


def _service(db: Client = Depends(get_db)) -> InventoryService:
    return InventoryService(db)


# ─── Reference data (all authenticated users) ────────────────────────────────


@router.get("/locations")
async def list_locations(
    current_user: CurrentUser = Depends(get_current_user),
    svc: InventoryService = Depends(_service),
):
    return {"data": svc.list_locations(current_user.lab_id)}


@router.get("/categories")
async def list_categories(
    current_user: CurrentUser = Depends(get_current_user),
    svc: InventoryService = Depends(_service),
):
    return {"data": svc.list_categories(current_user.lab_id)}


# ─── Inventory items ─────────────────────────────────────────────────────────


@router.get("/")
async def list_items(
    current_user: CurrentUser = Depends(get_current_user),
    svc: InventoryService = Depends(_service),
):
    items = svc.list_items(current_user.lab_id)
    return {"data": items, "total": len(items)}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_item(
    body: CreateItemRequest,
    current_user: CurrentUser = require_permission("manage_inventory"),
    svc: InventoryService = Depends(_service),
):
    item = svc.create_item(body.model_dump(), current_user)
    return {"data": item}


@router.get("/{item_id}")
async def get_item(
    item_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: InventoryService = Depends(_service),
):
    item = svc.get_item(item_id, current_user.lab_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return {"data": item}


@router.patch("/{item_id}")
async def update_item(
    item_id: str,
    body: UpdateItemRequest,
    current_user: CurrentUser = require_permission("manage_inventory"),
    svc: InventoryService = Depends(_service),
):
    if not svc.get_item(item_id, current_user.lab_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    updated = svc.update_item(item_id, body.model_dump(exclude_none=True), current_user)
    return {"data": updated}


@router.patch("/{item_id}/quantity")
async def update_quantity(
    item_id: str,
    body: UpdateQuantityRequest,
    current_user: CurrentUser = require_permission("manage_inventory"),
    svc: InventoryService = Depends(_service),
):
    updated = svc.update_quantity(item_id, body.quantity, current_user, body.notes)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return {"data": updated}


@router.get("/{item_id}/activity")
async def list_activity(
    item_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: InventoryService = Depends(_service),
):
    if not svc.get_item(item_id, current_user.lab_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return {"data": svc.list_activity(item_id, current_user.lab_id)}


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: InventoryService = Depends(_service),
):
    if current_user.role != "pi":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only PIs can delete inventory items",
        )
    if not svc.get_item(item_id, current_user.lab_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    svc.delete_item(item_id, current_user)
