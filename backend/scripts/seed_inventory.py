"""
Seed demo inventory data for ALMA LabOps.

Run after 002_inventory.sql has been executed:
    uv run python -m scripts.seed_inventory
"""

from supabase import create_client
from app.config import settings

LAB_ID = "00000000-0000-0000-0000-000000000002"

LOCATIONS = [
    {"name": "-80°C Freezer", "description": "Ultra-cold storage for cells, enzymes, frozen reagents"},
    {"name": "-20°C Freezer", "description": "Regular frozen storage for reagents and kits"},
    {"name": "4°C Refrigerator", "description": "Cold storage for media, buffers, and antibodies"},
    {"name": "Dry Storage A", "description": "Room-temperature plastics, consumables, and PPE"},
    {"name": "Chemical Cabinet", "description": "Flammables and hazardous chemical storage"},
    {"name": "Equipment Shelf B", "description": "Lab accessories and small equipment"},
]

CATEGORIES = [
    {"name": "Reagents", "color": "teal"},
    {"name": "Plastics & Consumables", "color": "blue"},
    {"name": "PPE", "color": "green"},
    {"name": "Buffers & Solutions", "color": "purple"},
    {"name": "Cell Culture", "color": "amber"},
    {"name": "Enzymes & Kits", "color": "indigo"},
]

ITEMS = [
    {
        "name": "Pipette Tips 1000μL",
        "category": "Plastics & Consumables",
        "location": "Dry Storage A",
        "quantity": 3,
        "unit": "boxes",
        "threshold": 5,
        "reorder_quantity": 10,
        "vendor": "Thermo Fisher",
        "catalog_number": "02-707-404",
    },
    {
        "name": "Pipette Tips 200μL",
        "category": "Plastics & Consumables",
        "location": "Dry Storage A",
        "quantity": 12,
        "unit": "boxes",
        "threshold": 5,
        "reorder_quantity": 10,
        "vendor": "Thermo Fisher",
        "catalog_number": "02-707-430",
    },
    {
        "name": "Pipette Tips 10μL",
        "category": "Plastics & Consumables",
        "location": "Dry Storage A",
        "quantity": 8,
        "unit": "boxes",
        "threshold": 5,
        "reorder_quantity": 10,
        "vendor": "Thermo Fisher",
        "catalog_number": "02-707-438",
    },
    {
        "name": "50mL Falcon Tubes",
        "category": "Plastics & Consumables",
        "location": "Dry Storage A",
        "quantity": 200,
        "unit": "tubes",
        "threshold": 50,
        "reorder_quantity": 500,
        "vendor": "Corning",
        "catalog_number": "352098",
    },
    {
        "name": "15mL Falcon Tubes",
        "category": "Plastics & Consumables",
        "location": "Dry Storage A",
        "quantity": 85,
        "unit": "tubes",
        "threshold": 50,
        "reorder_quantity": 500,
        "vendor": "Corning",
        "catalog_number": "352097",
    },
    {
        "name": "1.5mL Microcentrifuge Tubes",
        "category": "Plastics & Consumables",
        "location": "Dry Storage A",
        "quantity": 0,
        "unit": "bags",
        "threshold": 2,
        "reorder_quantity": 10,
        "vendor": "Eppendorf",
        "catalog_number": "022363204",
        "notes": "Last bag used 2 days ago — reorder urgent",
    },
    {
        "name": "96-Well PCR Plates",
        "category": "Plastics & Consumables",
        "location": "Dry Storage A",
        "quantity": 10,
        "unit": "plates",
        "threshold": 5,
        "reorder_quantity": 20,
        "vendor": "Bio-Rad",
        "catalog_number": "HSP9601",
    },
    {
        "name": "Ethanol 200 Proof",
        "category": "Buffers & Solutions",
        "location": "Chemical Cabinet",
        "quantity": 2,
        "unit": "L",
        "threshold": 5,
        "reorder_quantity": 10,
        "vendor": "Sigma-Aldrich",
        "catalog_number": "E7023",
        "notes": "Stored in flammables cabinet — handle with care",
    },
    {
        "name": "Nitrile Gloves (M)",
        "category": "PPE",
        "location": "Dry Storage A",
        "quantity": 4,
        "unit": "boxes",
        "threshold": 2,
        "reorder_quantity": 10,
        "vendor": "VWR",
        "catalog_number": "89038-314",
    },
    {
        "name": "Nitrile Gloves (L)",
        "category": "PPE",
        "location": "Dry Storage A",
        "quantity": 6,
        "unit": "boxes",
        "threshold": 2,
        "reorder_quantity": 10,
        "vendor": "VWR",
        "catalog_number": "89038-316",
    },
    {
        "name": "DPBS 1×",
        "category": "Buffers & Solutions",
        "location": "4°C Refrigerator",
        "quantity": 3,
        "unit": "L",
        "threshold": 2,
        "reorder_quantity": 5,
        "vendor": "Gibco",
        "catalog_number": "14190144",
    },
    {
        "name": "Trypsin-EDTA 0.25%",
        "category": "Cell Culture",
        "location": "-80°C Freezer",
        "quantity": 2,
        "unit": "vials",
        "threshold": 5,
        "reorder_quantity": 10,
        "vendor": "Gibco",
        "catalog_number": "25200-056",
        "notes": "Thaw at 37°C before use",
    },
    {
        "name": "DMEM Complete Media",
        "category": "Cell Culture",
        "location": "4°C Refrigerator",
        "quantity": 8,
        "unit": "bottles",
        "threshold": 3,
        "reorder_quantity": 6,
        "vendor": "Gibco",
        "catalog_number": "11965092",
    },
    {
        "name": "Q5 DNA Polymerase",
        "category": "Enzymes & Kits",
        "location": "-20°C Freezer",
        "quantity": 4,
        "unit": "units",
        "threshold": 2,
        "reorder_quantity": 5,
        "vendor": "NEB",
        "catalog_number": "M0491S",
        "notes": "High-fidelity PCR — keep at -20°C at all times",
    },
    {
        "name": "BSA Standard 2mg/mL",
        "category": "Reagents",
        "location": "4°C Refrigerator",
        "quantity": 1,
        "unit": "mL",
        "threshold": 5,
        "reorder_quantity": 10,
        "vendor": "Thermo Fisher",
        "catalog_number": "23208",
        "notes": "Used for BCA protein assay calibration",
    },
]


def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_role_key)

    # ── Locations ────────────────────────────────────────────────────────────
    print("Seeding locations...")
    location_map: dict[str, str] = {}
    for loc in LOCATIONS:
        res = (
            db.table("inventory_locations")
            .upsert({**loc, "lab_id": LAB_ID}, on_conflict="lab_id,name")
            .execute()
        )
        location_map[loc["name"]] = res.data[0]["id"]
        print(f"  ✓ {loc['name']}")

    # ── Categories ───────────────────────────────────────────────────────────
    print("Seeding categories...")
    category_map: dict[str, str] = {}
    for cat in CATEGORIES:
        res = (
            db.table("inventory_categories")
            .upsert({**cat, "lab_id": LAB_ID}, on_conflict="lab_id,name")
            .execute()
        )
        category_map[cat["name"]] = res.data[0]["id"]
        print(f"  ✓ {cat['name']}")

    # ── Inventory Items ──────────────────────────────────────────────────────
    print("Seeding inventory items...")
    for item in ITEMS:
        category_name = item.pop("category")
        location_name = item.pop("location")
        row = {
            **item,
            "lab_id": LAB_ID,
            "category_id": category_map.get(category_name),
            "location_id": location_map.get(location_name),
        }
        # Upsert by name + lab_id — idempotent re-runs
        existing = (
            db.table("inventory_items")
            .select("id")
            .eq("lab_id", LAB_ID)
            .eq("name", row["name"])
            .execute()
        )
        if existing.data:
            db.table("inventory_items").update(row).eq("id", existing.data[0]["id"]).execute()
        else:
            db.table("inventory_items").insert(row).execute()
        print(f"  ✓ {row['name']}")

    print("\nInventory seed complete.")
    print(f"  {len(LOCATIONS)} locations")
    print(f"  {len(CATEGORIES)} categories")
    print(f"  {len(ITEMS)} inventory items")


if __name__ == "__main__":
    main()
