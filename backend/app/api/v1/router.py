from fastapi import APIRouter

from app.api.v1.auth.router import router as auth_router
from app.api.v1.audit_logs.router import router as audit_logs_router
from app.api.v1.incoming_packages.router import router as incoming_packages_router
from app.api.v1.inventory.router import router as inventory_router
from app.api.v1.knowledge_base.router import router as knowledge_base_router
from app.api.v1.purchase_requests.router import router as purchase_requests_router
from app.api.v1.tasks.router import router as tasks_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(inventory_router, prefix="/inventory", tags=["inventory"])
router.include_router(
    purchase_requests_router,
    prefix="/purchase-requests",
    tags=["purchase-requests"],
)
router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
router.include_router(
    incoming_packages_router,
    prefix="/incoming-packages",
    tags=["incoming-packages"],
)
router.include_router(
    knowledge_base_router,
    prefix="/knowledge-base",
    tags=["knowledge-base"],
)
router.include_router(audit_logs_router, prefix="/audit-logs", tags=["audit-logs"])
