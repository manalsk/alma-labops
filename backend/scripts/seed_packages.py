"""
Seed demo incoming package records for ALMA LabOps.

Run after 005_incoming_packages.sql has been applied:
    uv run python -m scripts.seed_packages
"""

import datetime

from supabase import create_client

from app.config import settings

LAB_ID = "00000000-0000-0000-0000-000000000002"

DEMO_EMAILS = {
    "pi": "pi@demo.alma.lab",
    "researcher": "researcher@demo.alma.lab",
}

# Pre-signed URLs for images already uploaded to Supabase Storage
DEMO_PACKAGES = [
    {
        "image_url": "https://revwogxkmsrjckcxiehq.supabase.co/storage/v1/object/sign/package-images/demo/thermo-pipette-tips-1000ul.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83ZWQyYzI4My01YjJlLTQxN2YtYjhmYy1lNmJhMjkyOGY1MzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwYWNrYWdlLWltYWdlcy9kZW1vL3RoZXJtby1waXBldHRlLXRpcHMtMTAwMHVsLnBuZyIsImlhdCI6MTc3ODg0MjQ4MiwiZXhwIjoxNzgxNDM0NDgyfQ.bchsE9ozEQRGCBiIMY3BM8ZX6HMv26LSd9fIMqB822g",
        "image_path": "demo/thermo-pipette-tips-1000ul.png",
        "uploaded_by_role": "researcher",
        "extracted_item_name": "Pipette Tips 1000μL Filtered",
        "extracted_vendor": "Thermo Scientific",
        "extracted_quantity": 10,
        "extracted_unit": "boxes",
        "extracted_catalog_number": "TF-RT-1000F",
        "extracted_category": "Consumables",
        "extracted_storage_condition": None,
        "extraction_confidence": "high",
        "extraction_notes": "10 boxes of 96 filtered tips each",
        "extraction_mode": "mocked",
        "extraction_status": "completed",
        "review_status": "verified",
    },
    {
        "image_url": "https://revwogxkmsrjckcxiehq.supabase.co/storage/v1/object/sign/package-images/demo/sigma-ethanol-200-proof.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83ZWQyYzI4My01YjJlLTQxN2YtYjhmYy1lNmJhMjkyOGY1MzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwYWNrYWdlLWltYWdlcy9kZW1vL3NpZ21hLWV0aGFub2wtMjAwLXByb29mLnBuZyIsImlhdCI6MTc3ODg0MjQ2NCwiZXhwIjoxNzgxNDM0NDY0fQ.fzA4gaVVJ5PhbxG9PREBlGOFUGJuF5dEafsWJq4SkNo",
        "image_path": "demo/sigma-ethanol-200-proof.png",
        "uploaded_by_role": "researcher",
        "extracted_item_name": "Ethanol 200 Proof Reagent Grade",
        "extracted_vendor": "Sigma-Aldrich",
        "extracted_quantity": 4,
        "extracted_unit": "bottles",
        "extracted_catalog_number": "E7023-1L",
        "extracted_category": "Reagents",
        "extracted_storage_condition": "Flammable",
        "extraction_confidence": "high",
        "extraction_notes": "Highly flammable — store away from ignition sources",
        "extraction_mode": "mocked",
        "extraction_status": "completed",
        "review_status": "pending",
    },
    {
        "image_url": "https://revwogxkmsrjckcxiehq.supabase.co/storage/v1/object/sign/package-images/demo/vwr-falcon-tubes-15ml.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83ZWQyYzI4My01YjJlLTQxN2YtYjhmYy1lNmJhMjkyOGY1MzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwYWNrYWdlLWltYWdlcy9kZW1vL3Z3ci1mYWxjb24tdHViZXMtMTVtbC5wbmciLCJpYXQiOjE3Nzg4NDI0ODksImV4cCI6MTc4MTQzNDQ4OX0.pDJqrP5c24w0buP7EzLvlSvdvSE2KVtFvGkXTRF_ya4",
        "image_path": "demo/vwr-falcon-tubes-15ml.png",
        "uploaded_by_role": "researcher",
        "extracted_item_name": "Conical Tubes 15mL",
        "extracted_vendor": "VWR",
        "extracted_quantity": 500,
        "extracted_unit": "units",
        "extracted_catalog_number": "89039-666",
        "extracted_category": "Consumables",
        "extracted_storage_condition": None,
        "extraction_confidence": "high",
        "extraction_notes": "Polystyrene, sterile, RNase/DNase free",
        "extraction_mode": "mocked",
        "extraction_status": "completed",
        "review_status": "pending",
    },
    {
        "image_url": "https://revwogxkmsrjckcxiehq.supabase.co/storage/v1/object/sign/package-images/demo/thermo-anti-gfp-antibody.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83ZWQyYzI4My01YjJlLTQxN2YtYjhmYy1lNmJhMjkyOGY1MzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwYWNrYWdlLWltYWdlcy9kZW1vL3RoZXJtby1hbnRpLWdmcC1hbnRpYm9keS5wbmciLCJpYXQiOjE3Nzg4NDI0NzMsImV4cCI6MTc4MTQzNDQ3M30.nm7phNKjR6t5Dr7X0g96cJ7q39D6aLykqGditdnKAlc",
        "image_path": "demo/thermo-anti-gfp-antibody.png",
        "uploaded_by_role": "pi",
        "extracted_item_name": "Anti-GFP Antibody",
        "extracted_vendor": "Thermo Scientific",
        "extracted_quantity": 1,
        "extracted_unit": "vial",
        "extracted_catalog_number": "A-11122",
        "extracted_category": "Antibodies",
        "extracted_storage_condition": "Keep Frozen",
        "extraction_confidence": "high",
        "extraction_notes": "Rabbit polyclonal, 100μg. Store at -20°C",
        "extraction_mode": "mocked",
        "extraction_status": "completed",
        "review_status": "verified",
        "processed_at": (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat(),
    },
    {
        "image_url": "https://revwogxkmsrjckcxiehq.supabase.co/storage/v1/object/sign/package-images/demo/fisher-nitrile-gloves-medium.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83ZWQyYzI4My01YjJlLTQxN2YtYjhmYy1lNmJhMjkyOGY1MzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwYWNrYWdlLWltYWdlcy9kZW1vL2Zpc2hlci1uaXRyaWxlLWdsb3Zlcy1tZWRpdW0ucG5nIiwiaWF0IjoxNzc4ODQyNDE5LCJleHAiOjE3ODE0MzQ0MTl9.fAFPA3fZolKfHzTKnx7Ht898xWQ-teknrGwtMD7i5L4",
        "image_path": "demo/fisher-nitrile-gloves-medium.png",
        "uploaded_by_role": "student",
        "extracted_item_name": "NITRI-DEX Nitrile Examination Gloves",
        "extracted_vendor": "Fisherbrand",
        "extracted_quantity": 100,
        "extracted_unit": "gloves",
        "extracted_catalog_number": "19-130-1597B",
        "extracted_category": "PPE",
        "extracted_storage_condition": None,
        "extraction_confidence": "high",
        "extraction_notes": "Size M, powder-free, non-sterile",
        "extraction_mode": "mocked",
        "extraction_status": "completed",
        "review_status": "pending",
    },
]


def _get_user_id(db, email: str) -> str | None:
    page = 1
    while True:
        response = db.auth.admin.list_users(page=page, per_page=50)
        if not response:
            break
        for user in response:
            if user.email == email:
                return str(user.id)
        if len(response) < 50:
            break
        page += 1
    return None


def _get_user_name(db, user_id: str) -> str:
    result = db.table("profiles").select("full_name").eq("id", user_id).limit(1).execute()
    return result.data[0]["full_name"] if result.data else "Unknown"


def _get_org_id(db) -> str | None:
    result = db.table("labs").select("org_id").eq("id", LAB_ID).limit(1).execute()
    return result.data[0]["org_id"] if result.data else None


def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_role_key)

    org_id = _get_org_id(db)
    if not org_id:
        raise RuntimeError(f"Lab {LAB_ID} not found — run seed_users.py first")

    user_ids = {role: _get_user_id(db, email) for role, email in DEMO_EMAILS.items()}
    # Add student email
    user_ids["student"] = _get_user_id(db, "student@demo.alma.lab")

    missing = [role for role, uid in user_ids.items() if uid is None]
    if missing:
        raise RuntimeError(f"Missing user IDs for: {missing}")

    names = {role: _get_user_name(db, uid) for role, uid in user_ids.items()}

    for pkg in DEMO_PACKAGES:
        uploader_role = pkg.pop("uploaded_by_role")
        uploader_id = user_ids[uploader_role]
        uploader_name = names[uploader_role]

        row = {
            **pkg,
            "lab_id": LAB_ID,
            "org_id": org_id,
            "uploaded_by": uploader_id,
            "uploaded_by_name": uploader_name,
            "extraction_raw_json": {
                "item_name": pkg.get("extracted_item_name"),
                "vendor": pkg.get("extracted_vendor"),
                "quantity": pkg.get("extracted_quantity"),
                "unit": pkg.get("extracted_unit"),
                "catalog_number": pkg.get("extracted_catalog_number"),
                "category": pkg.get("extracted_category"),
                "storage_condition": pkg.get("extracted_storage_condition"),
                "confidence": pkg.get("extraction_confidence"),
                "notes": pkg.get("extraction_notes"),
            },
        }
        result = db.table("incoming_packages").insert(row).execute()
        pkg_row = result.data[0]
        pkg_id = pkg_row["id"]

        # Activity log
        db.table("package_activity_logs").insert({
            "package_id": pkg_id,
            "lab_id": LAB_ID,
            "actor_id": uploader_id,
            "actor_name": uploader_name,
            "action": "uploaded",
        }).execute()

        db.table("package_activity_logs").insert({
            "package_id": pkg_id,
            "lab_id": LAB_ID,
            "actor_id": uploader_id,
            "actor_name": uploader_name,
            "action": "mocked_extraction",
            "notes": f"Confidence: {row.get('extraction_confidence', 'high')}",
        }).execute()

        if row.get("review_status") == "verified":
            db.table("package_activity_logs").insert({
                "package_id": pkg_id,
                "lab_id": LAB_ID,
                "actor_id": user_ids["pi"],
                "actor_name": names["pi"],
                "action": "extraction_verified",
            }).execute()

        print(f"  ✓ Package: {row.get('extracted_item_name', 'Unknown')}")

    print(f"\nSeeded {len(DEMO_PACKAGES)} packages with activity logs.")


if __name__ == "__main__":
    main()
