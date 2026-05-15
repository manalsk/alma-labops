"""
Seed demo task data for ALMA LabOps.

Run after 004_tasks.sql has been applied:
    uv run python -m scripts.seed_tasks
"""

import datetime

from supabase import create_client

from app.config import settings

LAB_ID = "00000000-0000-0000-0000-000000000002"

DEMO_EMAILS = {
    "pi": "pi@demo.alma.lab",
    "researcher": "researcher@demo.alma.lab",
    "student": "student@demo.alma.lab",
}


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
    missing = [role for role, uid in user_ids.items() if uid is None]
    if missing:
        raise RuntimeError(f"Missing user IDs for: {missing} — run seed_users.py first")

    names = {role: _get_user_name(db, uid) for role, uid in user_ids.items()}

    today = datetime.date.today()

    tasks = [
        {
            "title": "Unpack and inventory new reagent shipment",
            "description": "Three boxes arrived from Thermo Fisher. Check each item against the packing list, update inventory quantities, and store in the correct freezer compartments.",
            "status": "in_progress",
            "priority": "high",
            "task_type": "package_intake",
            "assigned_to": user_ids["researcher"],
            "assigned_to_name": names["researcher"],
            "created_by": user_ids["pi"],
            "created_by_name": names["pi"],
            "due_date": (today + datetime.timedelta(days=1)).isoformat(),
        },
        {
            "title": "Reorganize -80°C freezer — purge expired samples",
            "description": "Samples older than 24 months with no active experiment link should be catalogued and disposed of per lab SOP-07. Photograph each shelf before and after.",
            "status": "todo",
            "priority": "medium",
            "task_type": "lab_maintenance",
            "assigned_to": user_ids["researcher"],
            "assigned_to_name": names["researcher"],
            "created_by": user_ids["pi"],
            "created_by_name": names["pi"],
            "due_date": (today + datetime.timedelta(days=5)).isoformat(),
        },
        {
            "title": "Verify pipette calibration records are up to date",
            "description": "Check the last calibration date for all P20, P200, and P1000 pipettes. Any unit overdue by more than 30 days should be flagged for external service.",
            "status": "todo",
            "priority": "medium",
            "task_type": "lab_maintenance",
            "assigned_to": user_ids["student"],
            "assigned_to_name": names["student"],
            "created_by": user_ids["pi"],
            "created_by_name": names["pi"],
            "due_date": (today + datetime.timedelta(days=3)).isoformat(),
        },
        {
            "title": "Upload updated gel electrophoresis SOP to knowledge base",
            "description": "The revised protocol (v2.4) was approved last week. Upload the PDF to the knowledge base under 'Protocols > Electrophoresis' and notify the team.",
            "status": "completed",
            "priority": "low",
            "task_type": "operational",
            "assigned_to": user_ids["researcher"],
            "assigned_to_name": names["researcher"],
            "created_by": user_ids["pi"],
            "created_by_name": names["pi"],
            "completed_at": (datetime.datetime.utcnow() - datetime.timedelta(days=2)).isoformat(),
        },
        {
            "title": "Label and organize chemical storage cabinet B",
            "description": "Cabinet B has unlabeled secondary containers from last month's restock. Apply GHS-compliant labels, update the chemical inventory, and confirm compatibility with adjacent storage.",
            "status": "blocked",
            "priority": "urgent",
            "task_type": "lab_maintenance",
            "assigned_to": user_ids["student"],
            "assigned_to_name": names["student"],
            "created_by": user_ids["researcher"],
            "created_by_name": names["researcher"],
            "due_date": (today - datetime.timedelta(days=1)).isoformat(),
        },
    ]

    inserted_ids = []
    for task in tasks:
        result = db.table("tasks").insert({
            **task,
            "lab_id": LAB_ID,
            "org_id": org_id,
        }).execute()
        task_row = result.data[0]
        inserted_ids.append((task_row["id"], task))
        print(f"  ✓ Task: {task['title'][:55]}...")

    # ── Seed activity logs ────────────────────────────────────────────────────
    for task_id, task in inserted_ids:
        actor_id = task["created_by"]
        actor_name = task["created_by_name"]

        db.table("task_activity_logs").insert({
            "task_id": task_id,
            "lab_id": LAB_ID,
            "actor_id": actor_id,
            "actor_name": actor_name,
            "action": "created",
            "new_value": "todo",
        }).execute()

        if task.get("assigned_to"):
            db.table("task_activity_logs").insert({
                "task_id": task_id,
                "lab_id": LAB_ID,
                "actor_id": actor_id,
                "actor_name": actor_name,
                "action": "assigned",
                "new_value": task["assigned_to_name"],
            }).execute()

        if task["status"] == "in_progress":
            db.table("task_activity_logs").insert({
                "task_id": task_id,
                "lab_id": LAB_ID,
                "actor_id": task["assigned_to"],
                "actor_name": task["assigned_to_name"],
                "action": "status_changed",
                "old_value": "todo",
                "new_value": "in_progress",
            }).execute()

        elif task["status"] == "completed":
            db.table("task_activity_logs").insert({
                "task_id": task_id,
                "lab_id": LAB_ID,
                "actor_id": task["assigned_to"],
                "actor_name": task["assigned_to_name"],
                "action": "completed",
                "old_value": "in_progress",
                "new_value": "completed",
            }).execute()

        elif task["status"] == "blocked":
            db.table("task_activity_logs").insert({
                "task_id": task_id,
                "lab_id": LAB_ID,
                "actor_id": task["assigned_to"],
                "actor_name": task["assigned_to_name"],
                "action": "status_changed",
                "old_value": "todo",
                "new_value": "blocked",
            }).execute()

    print(f"\nSeeded {len(inserted_ids)} tasks with activity logs.")


if __name__ == "__main__":
    main()
