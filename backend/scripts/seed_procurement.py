"""
Seed demo procurement data for ALMA LabOps.

Run after 003_procurement.sql has been applied:
    uv run python -m scripts.seed_procurement
"""

import datetime

from supabase import create_client

from app.config import settings

LAB_ID = "00000000-0000-0000-0000-000000000002"

DEMO_EMAILS = {
    "pi": "pi@demo.alma.lab",
    "researcher": "researcher@demo.alma.lab",
    "ops": "ops@demo.alma.lab",
    "student": "student@demo.alma.lab",
}

VENDORS = [
    {"name": "Thermo Fisher Scientific", "contact_name": "Sales Team", "contact_email": "orders@thermofisher.com", "website": "https://www.thermofisher.com"},
    {"name": "Sigma-Aldrich", "contact_name": "Lab Supply Desk", "contact_email": "orders@sigmaaldrich.com", "website": "https://www.sigmaaldrich.com"},
    {"name": "VWR International", "contact_name": "Account Rep", "contact_email": "orders@vwr.com", "website": "https://www.vwr.com"},
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


def _get_org_id(db) -> str | None:
    result = db.table("labs").select("org_id").eq("id", LAB_ID).limit(1).execute()
    return result.data[0]["org_id"] if result.data else None


def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_role_key)

    org_id = _get_org_id(db)
    if not org_id:
        raise RuntimeError(f"Lab {LAB_ID} not found — run seed_users.py first")

    # ── Resolve user IDs ──────────────────────────────────────────────────────
    user_ids = {role: _get_user_id(db, email) for role, email in DEMO_EMAILS.items()}
    missing = [role for role, uid in user_ids.items() if uid is None]
    if missing:
        raise RuntimeError(f"Missing profiles for: {missing} — run seed_users.py first")

    pi_id = user_ids["pi"]
    researcher_id = user_ids["researcher"]
    ops_id = user_ids["ops"]
    student_id = user_ids["student"]

    # ── Vendors ───────────────────────────────────────────────────────────────
    print("Seeding vendors...")
    vendor_map: dict[str, str] = {}
    for v in VENDORS:
        existing = (
            db.table("vendors")
            .select("id")
            .eq("lab_id", LAB_ID)
            .eq("name", v["name"])
            .execute()
        )
        if existing.data:
            vendor_map[v["name"]] = existing.data[0]["id"]
        else:
            res = db.table("vendors").insert({**v, "lab_id": LAB_ID, "org_id": org_id}).execute()
            vendor_map[v["name"]] = res.data[0]["id"]
        print(f"  ✓ {v['name']}")

    tf_id = vendor_map["Thermo Fisher Scientific"]
    sigma_id = vendor_map["Sigma-Aldrich"]
    vwr_id = vendor_map["VWR International"]

    # ── Purchase Requests ─────────────────────────────────────────────────────
    print("Seeding purchase requests...")

    def _insert_request(req_data: dict, items: list[dict]) -> str:
        title = req_data["title"]
        existing = (
            db.table("purchase_requests")
            .select("id")
            .eq("lab_id", LAB_ID)
            .eq("title", title)
            .execute()
        )
        if existing.data:
            print(f"  ~ {title} (already exists)")
            return existing.data[0]["id"]

        res = db.table("purchase_requests").insert(req_data).execute()
        rid = res.data[0]["id"]

        if items:
            db.table("purchase_request_items").insert([{**i, "request_id": rid} for i in items]).execute()

        # Compute estimated total
        total = sum(
            float(i.get("quantity", 1)) * float(i["estimated_unit_price"])
            for i in items
            if i.get("estimated_unit_price") is not None
        )
        if total:
            db.table("purchase_requests").update({"estimated_total": round(total, 2)}).eq("id", rid).execute()

        return rid

    def _log(request_id: str, actor_id: str, actor_name: str, action: str,
             old_status: str | None = None, new_status: str | None = None, notes: str | None = None) -> None:
        db.table("procurement_activity_logs").insert({
            "request_id": request_id,
            "lab_id": LAB_ID,
            "actor_id": actor_id,
            "actor_name": actor_name,
            "action": action,
            "old_status": old_status,
            "new_status": new_status,
            "notes": notes,
        }).execute()

    # 1. Pipette Tip Reorder — Researcher, Pending Approval
    r1 = _insert_request({
        "lab_id": LAB_ID, "org_id": org_id,
        "title": "Pipette Tips 1000μL — Reorder",
        "description": "Running low on 1000μL tips. Need to reorder before next week's experiments.",
        "requester_id": researcher_id, "requester_name": "Alex Rivera",
        "status": "pending_approval", "urgency": "high",
        "vendor_id": tf_id, "vendor_name": "Thermo Fisher Scientific",
        "is_suggestion": False,
    }, [
        {"item_name": "Pipette Tips 1000μL (10 boxes)", "quantity": 10, "unit": "boxes",
         "catalog_number": "02-707-404", "estimated_unit_price": 28.50},
        {"item_name": "Pipette Tips 200μL (5 boxes)", "quantity": 5, "unit": "boxes",
         "catalog_number": "02-707-410", "estimated_unit_price": 22.00},
    ])
    _log(r1, researcher_id, "Alex Rivera", "created", new_status="draft")
    _log(r1, researcher_id, "Alex Rivera", "submitted", old_status="draft", new_status="pending_approval")
    print("  ✓ Pipette Tip Reorder (pending_approval)")

    # 2. Ethanol 95% Restock — Ops Researcher, Approved
    r2 = _insert_request({
        "lab_id": LAB_ID, "org_id": org_id,
        "title": "Ethanol 95% — Emergency Restock",
        "description": "Ethanol is critically low. Required for weekly equipment sterilization protocols.",
        "requester_id": ops_id, "requester_name": "Jordan Kim",
        "status": "approved", "urgency": "critical",
        "vendor_id": sigma_id, "vendor_name": "Sigma-Aldrich",
        "approved_by": pi_id, "approver_name": "Dr. Sarah Chen",
        "approved_at": (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat(),
        "is_suggestion": False,
    }, [
        {"item_name": "Ethanol 95% — 4L", "quantity": 4, "unit": "bottles",
         "catalog_number": "459836-4L", "estimated_unit_price": 89.00},
    ])
    _log(r2, ops_id, "Jordan Kim", "created", new_status="draft")
    _log(r2, ops_id, "Jordan Kim", "submitted", old_status="draft", new_status="pending_approval")
    _log(r2, pi_id, "Dr. Sarah Chen", "approved", old_status="pending_approval", new_status="approved",
         notes="Critical protocol dependency. Approved immediately.")
    print("  ✓ Ethanol Restock (approved)")

    # 3. Nitrile Gloves — Ops Researcher, Pending
    r3 = _insert_request({
        "lab_id": LAB_ID, "org_id": org_id,
        "title": "Nitrile Gloves (M) — Bulk Order",
        "description": "Monthly glove restocking. Ordering 3 months supply to reduce order frequency.",
        "requester_id": ops_id, "requester_name": "Jordan Kim",
        "status": "pending_approval", "urgency": "normal",
        "vendor_id": vwr_id, "vendor_name": "VWR International",
        "is_suggestion": False,
    }, [
        {"item_name": "Nitrile Gloves Medium (100/box)", "quantity": 10, "unit": "boxes",
         "catalog_number": "89038-292", "estimated_unit_price": 14.75},
        {"item_name": "Nitrile Gloves Large (100/box)", "quantity": 5, "unit": "boxes",
         "catalog_number": "89038-294", "estimated_unit_price": 14.75},
    ])
    _log(r3, ops_id, "Jordan Kim", "created", new_status="draft")
    _log(r3, ops_id, "Jordan Kim", "submitted", old_status="draft", new_status="pending_approval")
    _log(r3, pi_id, "Dr. Sarah Chen", "clarification_requested",
         notes="Please confirm sizing split — do we need more M or L for current team?")
    print("  ✓ Nitrile Gloves Order (pending_approval, clarification requested)")

    # 4. PCR Master Mix — PI, Ordered
    r4 = _insert_request({
        "lab_id": LAB_ID, "org_id": org_id,
        "title": "PCR Master Mix — Q2 Supply",
        "description": "Quarterly PCR reagent order. Includes master mix and primer stocks for ongoing sequencing projects.",
        "requester_id": pi_id, "requester_name": "Dr. Sarah Chen",
        "status": "ordered", "urgency": "high",
        "vendor_id": tf_id, "vendor_name": "Thermo Fisher Scientific",
        "approved_by": pi_id, "approver_name": "Dr. Sarah Chen",
        "approved_at": (datetime.datetime.utcnow() - datetime.timedelta(days=3)).isoformat(),
        "ordered_at": (datetime.datetime.utcnow() - datetime.timedelta(days=2)).isoformat(),
        "is_suggestion": False,
    }, [
        {"item_name": "KAPA HiFi PCR Master Mix (100 reactions)", "quantity": 5, "unit": "units",
         "catalog_number": "KK2601", "vendor": "Thermo Fisher Scientific", "estimated_unit_price": 195.00},
        {"item_name": "Nuclease-Free Water (500mL)", "quantity": 3, "unit": "bottles",
         "catalog_number": "AM9930", "estimated_unit_price": 38.00},
    ])
    _log(r4, pi_id, "Dr. Sarah Chen", "created", new_status="draft")
    _log(r4, pi_id, "Dr. Sarah Chen", "submitted", old_status="draft", new_status="pending_approval")
    _log(r4, pi_id, "Dr. Sarah Chen", "approved", old_status="pending_approval", new_status="approved")
    _log(r4, pi_id, "Dr. Sarah Chen", "ordered", old_status="approved", new_status="ordered")
    print("  ✓ PCR Master Mix (ordered)")

    # 5. Microscope Maintenance — PI, Draft
    r5 = _insert_request({
        "lab_id": LAB_ID, "org_id": org_id,
        "title": "Fluorescence Microscope — Annual Maintenance Contract",
        "description": "Annual preventive maintenance contract for the Nikon Ti2 fluorescence microscope. Includes calibration, cleaning, and 2 emergency service calls.",
        "requester_id": pi_id, "requester_name": "Dr. Sarah Chen",
        "status": "draft", "urgency": "low",
        "vendor_name": "Nikon Instruments",
        "is_suggestion": False,
        "notes": "Contract renewal due end of Q2. Get quotes from 2 vendors before submitting.",
    }, [
        {"item_name": "Annual Maintenance Contract — Nikon Ti2", "quantity": 1, "unit": "units",
         "estimated_unit_price": 4200.00},
    ])
    _log(r5, pi_id, "Dr. Sarah Chen", "created", new_status="draft")
    print("  ✓ Microscope Maintenance (draft)")

    # 6. Student Suggestion — BSA Standard
    r6 = _insert_request({
        "lab_id": LAB_ID, "org_id": org_id,
        "title": "BSA Standard — Restock Suggestion",
        "description": "BSA Standard is out of stock. I needed it for my protein quantification assay and had to borrow from another lab.",
        "requester_id": student_id, "requester_name": "Maya Patel",
        "status": "pending_approval", "urgency": "normal",
        "vendor_id": sigma_id, "vendor_name": "Sigma-Aldrich",
        "is_suggestion": True,
    }, [
        {"item_name": "BSA Standard 2mg/mL (10 ampules)", "quantity": 2, "unit": "units",
         "catalog_number": "23208", "estimated_unit_price": 42.00},
    ])
    _log(r6, student_id, "Maya Patel", "created", new_status="pending_approval")
    _log(r6, student_id, "Maya Patel", "submitted", old_status="draft", new_status="pending_approval")
    print("  ✓ BSA Standard Suggestion (student suggestion, pending)")

    print(f"\nProcurement seed complete.")
    print(f"  {len(VENDORS)} vendors")
    print(f"  6 purchase requests")


if __name__ == "__main__":
    main()
