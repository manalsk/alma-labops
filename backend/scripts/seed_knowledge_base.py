"""
Seed demo KB documents for ALMA LabOps.

Assumes demo markdown files are already uploaded to Supabase Storage
under the bucket `kb-documents` at path `demo/<filename>`.

Run after 006_knowledge_base.sql has been applied:
    uv run python -m scripts.seed_knowledge_base
"""

import asyncio
from pathlib import Path

from supabase import create_client

from app.config import settings
from app.ai.rag_assistant import generate_embedding
from app.services.knowledge_base.service import KnowledgeBaseService

LAB_ID = "00000000-0000-0000-0000-000000000002"

# Local copies used only for reading text to embed
DEMO_DIR = (
    Path(__file__).parent.parent.parent / "demo-assets" / "kb-documents"
)

DEMO_DOCS = [
    {
        "filename": "onboarding-new-student-lab-guide.md",
        "title": "New Student Lab Onboarding Guide",
        "category": "onboarding",
        "visibility": "all_lab_members",
    },
    {
        "filename": "sop-biohazard-waste-disposal.md",
        "title": "SOP: Biohazard Waste Disposal",
        "category": "safety",
        "visibility": "all_lab_members",
    },
    {
        "filename": "sop-cold-storage-and-freezer-inventory.md",
        "title": "SOP: Cold Storage and Freezer Inventory",
        "category": "sop",
        "visibility": "all_lab_members",
    },
    {
        "filename": "sop-package-intake-and-inventory-update.md",
        "title": "SOP: Package Intake and Inventory Update",
        "category": "sop",
        "visibility": "all_lab_members",
    },
    {
        "filename": "sop-procurement-request-policy.md",
        "title": "SOP: Procurement Request Policy",
        "category": "policy",
        "visibility": "all_lab_members",
    },
    {
        "filename": "procurement-budget-policy-restricted.md",
        "title": "Restricted Procurement and Budget Policy",
        "category": "policy",
        "visibility": "researchers_only",
    },
    {
        "filename": "lab-admin-security-policy.md",
        "title": "Laboratory Administrative Security Policy",
        "category": "policy",
        "visibility": "pi_only",
    },
]


async def _ingest(svc: KnowledgeBaseService, doc_id: str, text: str, lab_id: str) -> int:
    chunks = KnowledgeBaseService.chunk_text(text)
    chunk_pairs: list[tuple[str, list[float]]] = []
    for chunk in chunks:
        embedding = await generate_embedding(chunk)
        chunk_pairs.append((chunk, embedding))
    svc.store_chunks(doc_id=doc_id, lab_id=lab_id, chunks=chunk_pairs)
    return len(chunk_pairs)


async def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_role_key)
    svc = KnowledgeBaseService(db)

    # Find PI for audit authorship
    pi_result = (
        db.table("profiles")
        .select("id, full_name")
        .eq("lab_id", LAB_ID)
        .eq("role", "pi")
        .limit(1)
        .execute()
    )
    if not pi_result.data:
        raise RuntimeError("No PI found for demo lab — run seed_users.py first")

    pi = pi_result.data[0]

    class _Actor:
        id = pi["id"]
        full_name = pi["full_name"]
        role = "pi"

    actor = _Actor()
    seeded = 0

    for spec in DEMO_DOCS:
        local_path = DEMO_DIR / spec["filename"]
        if not local_path.exists():
            print(f"  ✗ Missing local file: {local_path}")
            continue

        # Files already exist in Storage at demo/<filename>
        storage_path = f"demo/{spec['filename']}"

        # Create a 1-year signed URL for the existing storage file
        signed = db.storage.from_("kb-documents").create_signed_url(
            storage_path, expires_in=31536000
        )
        signed_url = signed.get("signedURL") or signed.get("signed_url") or ""

        if not signed_url:
            print(f"  ✗ Could not get signed URL for {storage_path} — skipping")
            continue

        # Create document record
        doc = svc.create_document_record(
            lab_id=LAB_ID,
            title=spec["title"],
            category=spec["category"],
            file_url=signed_url,
            file_path=storage_path,
            file_type="text/markdown",
            visibility=spec["visibility"],
            actor=actor,
        )

        # Read local file content and embed
        text = local_path.read_text(encoding="utf-8")
        n_chunks = await _ingest(svc, doc["id"], text, LAB_ID)
        seeded += 1
        print(f"  ✓ {spec['title']} [{spec['visibility']}] — {n_chunks} chunks")

    print(f"\nSeeded {seeded}/{len(DEMO_DOCS)} KB documents.")


if __name__ == "__main__":
    asyncio.run(main())
