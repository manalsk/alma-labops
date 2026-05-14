from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_documents():
    """List knowledge base documents for the authenticated user's lab. Implemented in Phase 2."""
    return {"message": "knowledge base endpoints coming in Phase 2"}
