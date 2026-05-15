"""
ALMA LabOps — Demo User Seeder
Creates Supabase auth users and profiles for the 4 demo roles.

Prerequisites:
  - Run supabase/migrations/001_schema.sql in Supabase SQL Editor
  - Run supabase/seed.sql in Supabase SQL Editor
  - backend/.env must have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

Usage:
  cd backend
  uv run python -m scripts.seed_users
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env")
    sys.exit(1)

from supabase import create_client  # noqa: E402

ORG_ID = "00000000-0000-0000-0000-000000000001"
LAB_ID = "00000000-0000-0000-0000-000000000002"
DEMO_PASSWORD = "demo1234"

DEMO_USERS = [
    {
        "email": "pi@demo.alma.lab",
        "full_name": "Dr. Sarah Chen",
        "role": "pi",
        "extra_permissions": [],
    },
    {
        "email": "researcher@demo.alma.lab",
        "full_name": "Alex Rivera",
        "role": "researcher",
        "extra_permissions": [],
    },
    {
        "email": "ops@demo.alma.lab",
        "full_name": "Jordan Kim",
        "role": "researcher",
        # Ops Researcher = researcher role + elevated delegated permissions
        "extra_permissions": [
            "manage_locations",
            "manage_vendors",
            "upload_kb_docs",
            "assign_permissions",
            "manage_categories",
        ],
    },
    {
        "email": "student@demo.alma.lab",
        "full_name": "Maya Patel",
        "role": "student",
        "extra_permissions": [],
    },
]


def get_existing_user_id(client, email: str) -> str | None:
    try:
        page = 1
        while True:
            response = client.auth.admin.list_users(page=page, per_page=50)
            if not response:
                break
            for user in response:
                if user.email == email:
                    return str(user.id)
            if len(response) < 50:
                break
            page += 1
    except Exception as e:
        print(f"  Warning: could not list users: {e}")
    return None


def seed() -> None:
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    for user_data in DEMO_USERS:
        print(f"\n→ {user_data['email']} ({user_data['role']})")

        # Create or find auth user
        user_id: str | None = None
        try:
            response = client.auth.admin.create_user(
                {
                    "email": user_data["email"],
                    "password": DEMO_PASSWORD,
                    "email_confirm": True,
                }
            )
            user_id = str(response.user.id)
            print(f"  ✓ Auth user created: {user_id}")
        except Exception as e:
            err = str(e).lower()
            if "already" in err or "registered" in err or "exists" in err:
                user_id = get_existing_user_id(client, user_data["email"])
                if user_id:
                    print(f"  ✓ Auth user already exists: {user_id}")
                else:
                    print(f"  ✗ Could not find existing user for {user_data['email']}")
                    continue
            else:
                print(f"  ✗ Error creating auth user: {e}")
                continue

        # Upsert profile
        try:
            client.table("profiles").upsert(
                {
                    "id": user_id,
                    "org_id": ORG_ID,
                    "lab_id": LAB_ID,
                    "full_name": user_data["full_name"],
                    "role": user_data["role"],
                    "is_active": True,
                }
            ).execute()
            print(f"  ✓ Profile upserted: {user_data['full_name']}")
        except Exception as e:
            print(f"  ✗ Error upserting profile: {e}")
            continue

        # Grant delegated permissions
        for perm in user_data["extra_permissions"]:
            try:
                client.table("user_permissions").upsert(
                    {
                        "user_id": user_id,
                        "permission_name": perm,
                    }
                ).execute()
                print(f"  ✓ Permission granted: {perm}")
            except Exception as e:
                print(f"  ✗ Error granting {perm}: {e}")


if __name__ == "__main__":
    print("ALMA LabOps — Demo User Seeder")
    print("=" * 40)
    seed()
    print("\n" + "=" * 40)
    print("Seeding complete!")
    print("\nDemo credentials:")
    print(f"  Password for all users: {DEMO_PASSWORD}")
    for u in DEMO_USERS:
        label = "Operations Researcher" if u["email"].startswith("ops") else u["role"].upper()
        print(f"  {u['email']}  ({label})")
