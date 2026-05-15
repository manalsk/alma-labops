"""Incoming package intake API — upload, AI extraction, human review, inventory/task creation."""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.dependencies import get_current_user, get_db, require_permission
from app.models.auth import CurrentUser
from app.models.package import (
    CreateInventoryFromPackageRequest,
    CreateTaskFromPackageRequest,
    VerifyExtractionRequest,
)
from app.services.incoming_packages.service import IncomingPackageService
from app.ai.package_vision import mock_extract, live_extract
from supabase import Client

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _svc(db: Client = Depends(get_db)) -> IncomingPackageService:
    return IncomingPackageService(db)


def _get_or_404(svc: IncomingPackageService, package_id: str, lab_id: str) -> dict:
    pkg = svc.get_package(package_id, lab_id)
    if not pkg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    return pkg


# ── List ──────────────────────────────────────────────────────────────────────


@router.get("/")
async def list_packages(
    review_status: str | None = Query(None),
    extraction_status: str | None = Query(None),
    uploaded_by: str | None = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    svc: IncomingPackageService = Depends(_svc),
):
    packages = svc.list_packages(
        lab_id=current_user.lab_id,
        review_status=review_status,
        extraction_status=extraction_status,
        uploaded_by=uploaded_by,
    )
    return {"data": packages, "total": len(packages)}


# ── Upload ────────────────────────────────────────────────────────────────────


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_package(
    image: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    svc: IncomingPackageService = Depends(_svc),
):
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )

    image_bytes = await image.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds 10 MB limit",
        )

    try:
        path, signed_url = svc.upload_to_storage(
            image_bytes=image_bytes,
            filename=image.filename or "package.jpg",
            content_type=image.content_type or "image/jpeg",
            lab_id=current_user.lab_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage upload failed: {exc}",
        ) from exc

    pkg = svc.create_package(
        image_url=signed_url,
        image_path=path,
        actor=current_user,
    )
    return {"data": pkg}


# ── Get single ────────────────────────────────────────────────────────────────


@router.get("/{package_id}")
async def get_package(
    package_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: IncomingPackageService = Depends(_svc),
):
    return {"data": _get_or_404(svc, package_id, current_user.lab_id)}


# ── AI Extraction ─────────────────────────────────────────────────────────────


@router.post("/{package_id}/extract")
async def run_extraction(
    package_id: str,
    mode: str = Query("mocked", description="mocked or live"),
    current_user: CurrentUser = Depends(get_current_user),
    svc: IncomingPackageService = Depends(_svc),
):
    if mode not in ("mocked", "live"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="mode must be 'mocked' or 'live'")

    pkg = _get_or_404(svc, package_id, current_user.lab_id)
    image_url = pkg["image_url"]

    # Mark as processing
    svc.db.table("incoming_packages").update({
        "extraction_status": "processing",
    }).eq("id", package_id).eq("lab_id", current_user.lab_id).execute()

    tokens_used: int | None = None
    try:
        if mode == "mocked":
            extraction = mock_extract(image_url)
        else:
            extraction, tokens_used = await live_extract(image_url)

        updated = svc.save_extraction(
            package_id=package_id,
            lab_id=current_user.lab_id,
            extraction=extraction,
            mode=mode,
            actor=current_user,
            tokens_used=tokens_used,
            prior_review_status=pkg["review_status"],
        )
    except Exception as exc:
        svc.mark_extraction_failed(package_id, current_user.lab_id, current_user, str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI extraction failed: {exc}",
        ) from exc

    return {"data": updated, "extraction_mode": mode}


# ── Human Review ──────────────────────────────────────────────────────────────


@router.post("/{package_id}/verify")
async def verify_extraction(
    package_id: str,
    body: VerifyExtractionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    svc: IncomingPackageService = Depends(_svc),
):
    if current_user.role not in ("pi", "researcher"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    _get_or_404(svc, package_id, current_user.lab_id)
    updated = svc.verify_extraction(package_id, body.model_dump(exclude_none=True), current_user)
    return {"data": updated}


@router.post("/{package_id}/reject")
async def reject_extraction(
    package_id: str,
    notes: str | None = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    svc: IncomingPackageService = Depends(_svc),
):
    if current_user.role not in ("pi", "researcher"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    _get_or_404(svc, package_id, current_user.lab_id)
    updated = svc.reject_extraction(package_id, notes, current_user)
    return {"data": updated}


# ── Inventory Integration ─────────────────────────────────────────────────────


@router.post("/{package_id}/create-inventory")
async def create_inventory_from_package(
    package_id: str,
    body: CreateInventoryFromPackageRequest,
    current_user: CurrentUser = require_permission("manage_inventory"),
    svc: IncomingPackageService = Depends(_svc),
):
    pkg = _get_or_404(svc, package_id, current_user.lab_id)
    if pkg.get("linked_inventory_item_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An inventory item has already been created from this package",
        )
    updated = svc.create_inventory_from_package(package_id, body.model_dump(), current_user)
    return {"data": updated}


# ── Task Integration ──────────────────────────────────────────────────────────


@router.post("/{package_id}/create-task")
async def create_task_from_package(
    package_id: str,
    body: CreateTaskFromPackageRequest,
    current_user: CurrentUser = require_permission("assign_tasks"),
    svc: IncomingPackageService = Depends(_svc),
):
    pkg = _get_or_404(svc, package_id, current_user.lab_id)
    if pkg.get("linked_task_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A task has already been created from this package",
        )
    updated = svc.create_task_from_package(package_id, body.model_dump(), current_user)
    return {"data": updated}


# ── Mark Processed ────────────────────────────────────────────────────────────


@router.post("/{package_id}/process")
async def mark_processed(
    package_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: IncomingPackageService = Depends(_svc),
):
    if current_user.role not in ("pi", "researcher"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    _get_or_404(svc, package_id, current_user.lab_id)
    updated = svc.mark_processed(package_id, current_user)
    return {"data": updated}


# ── Activity ──────────────────────────────────────────────────────────────────


@router.get("/{package_id}/activity")
async def list_activity(
    package_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: IncomingPackageService = Depends(_svc),
):
    _get_or_404(svc, package_id, current_user.lab_id)
    return {"data": svc.list_activity(package_id)}
