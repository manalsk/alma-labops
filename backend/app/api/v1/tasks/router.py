"""Task management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user, get_db, require_permission
from app.models.auth import CurrentUser
from app.models.task import CreateTaskRequest, UpdateTaskRequest, UpdateTaskStatusRequest
from app.services.tasks.service import TaskService
from supabase import Client

router = APIRouter()

VALID_STATUSES = {"todo", "in_progress", "blocked", "completed"}


def _svc(db: Client = Depends(get_db)) -> TaskService:
    return TaskService(db)


def _get_or_404(svc: TaskService, task_id: str, lab_id: str) -> dict:
    task = svc.get_task(task_id, lab_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


# ── List / Create ─────────────────────────────────────────────────────────────


@router.get("/")
async def list_tasks(
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    task_type: str | None = Query(None),
    assigned_to: str | None = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    tasks = svc.list_tasks(
        lab_id=current_user.lab_id,
        status=status_filter,
        priority=priority,
        task_type=task_type,
        assigned_to=assigned_to,
    )
    return {"data": tasks, "total": len(tasks)}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_task(
    body: CreateTaskRequest,
    current_user: CurrentUser = require_permission("assign_tasks"),
    svc: TaskService = Depends(_svc),
):
    task = svc.create_task(body.model_dump(), current_user)
    return {"data": task}


# ── Single task ───────────────────────────────────────────────────────────────


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    return {"data": _get_or_404(svc, task_id, current_user.lab_id)}


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    body: UpdateTaskRequest,
    current_user: CurrentUser = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    if current_user.role not in ("pi", "researcher"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only PI and researchers can edit tasks",
        )
    _get_or_404(svc, task_id, current_user.lab_id)
    data = body.model_dump(exclude_none=True)
    updated = svc.update_task(task_id, data, current_user)
    return {"data": updated}


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    if current_user.role != "pi":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the PI can delete tasks",
        )
    _get_or_404(svc, task_id, current_user.lab_id)
    svc.delete_task(task_id, current_user)


# ── Status transition ─────────────────────────────────────────────────────────


@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: str,
    body: UpdateTaskStatusRequest,
    current_user: CurrentUser = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    task = _get_or_404(svc, task_id, current_user.lab_id)

    if current_user.role == "student":
        if task.get("assigned_to") != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students can only update the status of tasks assigned to them",
            )

    updated = svc.update_status(task_id, body.status, current_user)
    return {"data": updated}


# ── Activity log ──────────────────────────────────────────────────────────────


@router.get("/{task_id}/activity")
async def list_activity(
    task_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    _get_or_404(svc, task_id, current_user.lab_id)
    return {"data": svc.list_activity(task_id)}
