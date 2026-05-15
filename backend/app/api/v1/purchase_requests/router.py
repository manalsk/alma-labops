from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user, get_db, require_permission
from app.models.auth import CurrentUser
from app.models.procurement import (
    ActionNoteRequest,
    ClarificationRequest,
    CreatePurchaseRequestRequest,
    UpdatePurchaseRequestRequest,
)
from app.services.purchase_requests.service import ProcurementService
from supabase import Client

router = APIRouter()


def _svc(db: Client = Depends(get_db)) -> ProcurementService:
    return ProcurementService(db)


def _get_or_404(svc: ProcurementService, request_id: str, lab_id: str) -> dict:
    req = svc.get_request(request_id, lab_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return req


# ── Reference data ────────────────────────────────────────────────────────────


@router.get("/vendors")
async def list_vendors(
    current_user: CurrentUser = Depends(get_current_user),
    svc: ProcurementService = Depends(_svc),
):
    return {"data": svc.list_vendors(current_user.lab_id)}


# ── List / Create ─────────────────────────────────────────────────────────────


@router.get("/")
async def list_requests(
    status_filter: str | None = Query(None, alias="status"),
    urgency: str | None = Query(None),
    requester_id: str | None = Query(None),
    vendor_id: str | None = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    svc: ProcurementService = Depends(_svc),
):
    requests = svc.list_requests(
        lab_id=current_user.lab_id,
        status=status_filter,
        urgency=urgency,
        requester_id=requester_id,
        vendor_id=vendor_id,
    )
    return {"data": requests, "total": len(requests)}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_request(
    body: CreatePurchaseRequestRequest,
    current_user: CurrentUser = Depends(get_current_user),
    svc: ProcurementService = Depends(_svc),
):
    data = body.model_dump()
    # Students always submit immediately as suggestions (handled in service)
    req = svc.create_request(data, current_user)
    return {"data": req}


# ── Single request ────────────────────────────────────────────────────────────


@router.get("/{request_id}")
async def get_request(
    request_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: ProcurementService = Depends(_svc),
):
    return {"data": _get_or_404(svc, request_id, current_user.lab_id)}


@router.patch("/{request_id}")
async def update_request(
    request_id: str,
    body: UpdatePurchaseRequestRequest,
    current_user: CurrentUser = Depends(get_current_user),
    svc: ProcurementService = Depends(_svc),
):
    req = _get_or_404(svc, request_id, current_user.lab_id)

    # Researchers/students can only edit their own draft/pending requests
    if current_user.role != "pi":
        if req["requester_id"] != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own requests")
        if req["status"] not in ("draft", "pending_approval"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit a request that is already approved or rejected")

    data = body.model_dump(exclude_none=True)
    updated = svc.update_request(request_id, data, current_user)
    return {"data": updated}


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_request(
    request_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: ProcurementService = Depends(_svc),
):
    req = _get_or_404(svc, request_id, current_user.lab_id)

    if current_user.role != "pi":
        if req["requester_id"] != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own requests")
        if req["status"] != "draft":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only draft requests can be deleted")

    svc.delete_request(request_id, current_user)


# ── Workflow transitions ───────────────────────────────────────────────────────


@router.post("/{request_id}/submit")
async def submit_request(
    request_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: ProcurementService = Depends(_svc),
):
    req = _get_or_404(svc, request_id, current_user.lab_id)
    if req["status"] != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft requests can be submitted")
    if current_user.role != "pi" and req["requester_id"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only submit your own requests")
    return {"data": svc.submit_request(request_id, current_user)}


@router.post("/{request_id}/approve")
async def approve_request(
    request_id: str,
    body: ActionNoteRequest,
    current_user: CurrentUser = require_permission("approve_purchase_request"),
    svc: ProcurementService = Depends(_svc),
):
    req = _get_or_404(svc, request_id, current_user.lab_id)
    if req["status"] != "pending_approval":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending requests can be approved")
    return {"data": svc.approve_request(request_id, body.notes, current_user)}


@router.post("/{request_id}/reject")
async def reject_request(
    request_id: str,
    body: ActionNoteRequest,
    current_user: CurrentUser = require_permission("approve_purchase_request"),
    svc: ProcurementService = Depends(_svc),
):
    req = _get_or_404(svc, request_id, current_user.lab_id)
    if req["status"] != "pending_approval":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending requests can be rejected")
    return {"data": svc.reject_request(request_id, body.notes, current_user)}


@router.post("/{request_id}/clarification")
async def request_clarification(
    request_id: str,
    body: ClarificationRequest,
    current_user: CurrentUser = require_permission("approve_purchase_request"),
    svc: ProcurementService = Depends(_svc),
):
    _get_or_404(svc, request_id, current_user.lab_id)
    return {"data": svc.request_clarification(request_id, body.note, current_user)}


@router.post("/{request_id}/order")
async def mark_ordered(
    request_id: str,
    current_user: CurrentUser = require_permission("approve_purchase_request"),
    svc: ProcurementService = Depends(_svc),
):
    req = _get_or_404(svc, request_id, current_user.lab_id)
    if req["status"] != "approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only approved requests can be marked ordered")
    return {"data": svc.mark_ordered(request_id, current_user)}


@router.post("/{request_id}/receive")
async def mark_received(
    request_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: ProcurementService = Depends(_svc),
):
    req = _get_or_404(svc, request_id, current_user.lab_id)
    if req["status"] != "ordered":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only ordered requests can be marked received")
    if current_user.role not in ("pi", "researcher"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return {"data": svc.mark_received(request_id, current_user)}


@router.get("/{request_id}/activity")
async def list_activity(
    request_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: ProcurementService = Depends(_svc),
):
    _get_or_404(svc, request_id, current_user.lab_id)
    return {"data": svc.list_activity(request_id)}
