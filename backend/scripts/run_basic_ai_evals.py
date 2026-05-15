"""
Manual AI eval runner for ALMA LabOps.

Usage:
    cd backend
    python -m scripts.run_basic_ai_evals [--system rag|copilot] [--id cop_01]

Reads eval cases from evals/basic_ai_eval_cases.json (project root).
Calls the actual AI functions — no mocking.
Requires a valid OPENAI_API_KEY in backend/.env.

Output: terminal table with PASS/FAIL per case.
"""
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent.parent
EVAL_FILE = BACKEND_DIR.parent / "evals" / "basic_ai_eval_cases.json"

sys.path.insert(0, str(BACKEND_DIR))

# Load .env before importing app modules
from dotenv import load_dotenv  # noqa: E402
load_dotenv(BACKEND_DIR / ".env")

from app.ai.copilot import generate_copilot_answer  # noqa: E402
from app.ai.rag_assistant import answer_question     # noqa: E402


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check(answer: str, was_refused: bool, case: dict) -> tuple[bool, str]:
    """Return (passed, reason)."""
    expect_refused = case.get("expect_refused", False)
    expect_any = case.get("expect_contains_any", [])

    if expect_refused and not was_refused:
        return False, "Expected refusal but got answer"

    if not expect_refused and was_refused:
        return False, "Expected answer but got refusal"

    if expect_any:
        lower = answer.lower()
        if not any(kw.lower() in lower for kw in expect_any):
            keywords = ", ".join(expect_any)
            return False, f"Answer missing expected keywords: [{keywords}]"

    return True, "ok"


def _bar(label: str, width: int = 70) -> None:
    print(f"\n{'─' * width}")
    print(f"  {label}")
    print(f"{'─' * width}")


def _result_line(case_id: str, name: str, passed: bool, reason: str, tokens: int) -> None:
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"  {status}  [{case_id}] {name}")
    if not passed:
        print(f"         → {reason}")
    if tokens:
        print(f"         tokens: {tokens}")


# ── Copilot eval ──────────────────────────────────────────────────────────────

DUMMY_CONTEXT: dict[str, list[dict]] = {
    "pi": [
        {
            "title": "Inventory",
            "content": (
                "Total inventory items: 12\n"
                "Low / out-of-stock (2):\n"
                "  - Ethanol 70%: 0 mL (out_of_stock, Shelf A)\n"
                "  - Nitrile Gloves S: 5 box (low_stock, Supply Room)\n"
                "\nFull inventory:\n"
                "  - PBS Buffer: 4 L, status=in_stock, location=Shelf B, vendor=Sigma\n"
                "  - Ethanol 70%: 0 mL, status=out_of_stock, location=Shelf A, vendor=Fisher\n"
                "  - Nitrile Gloves S: 5 box, status=low_stock, location=Supply Room, vendor=VWR"
            ),
        },
        {
            "title": "Tasks",
            "content": (
                "Open tasks (3):\n"
                "  - [HIGH] Reorder ethanol — Alice Chen, status=todo, due 2026-05-20\n"
                "  - [MEDIUM] Monthly equipment check — Bob Smith, status=in_progress\n"
                "  - [LOW] Update MSDS binders — Unassigned, status=todo"
            ),
        },
        {
            "title": "Procurement",
            "content": (
                "Purchase requests (2):\n"
                "  - [HIGH] Antibody panel order — pending_approval, by Alice Chen, est. $340.00\n"
                "  - [NORMAL] Lab consumables restock — draft, by Bob Smith"
            ),
        },
        {
            "title": "Incoming Packages",
            "content": "No packages currently pending review.",
        },
        {
            "title": "Recent Activity",
            "content": (
                "Recent lab activity:\n"
                "  - [2026-05-14] Inventory item 'Ethanol 70%' updated (pi)\n"
                "  - [2026-05-13] Purchase request 'Antibody panel order' submitted (researcher)"
            ),
        },
    ],
    "researcher": [
        {
            "title": "Inventory",
            "content": (
                "Total inventory items: 12\n"
                "Low / out-of-stock (2):\n"
                "  - Ethanol 70%: 0 mL (out_of_stock, Shelf A)\n"
                "  - Nitrile Gloves S: 5 box (low_stock, Supply Room)"
            ),
        },
        {
            "title": "Tasks",
            "content": (
                "Open tasks (1):\n"
                "  - [HIGH] Reorder ethanol — Alice Chen, status=todo, due 2026-05-20"
            ),
        },
        {
            "title": "Procurement",
            "content": (
                "Purchase requests (1):\n"
                "  - [HIGH] Antibody panel order — pending_approval, by Alice Chen, est. $340.00"
            ),
        },
    ],
    "student": [
        {
            "title": "Inventory",
            "content": (
                "Total inventory items: 12\n"
                "Low / out-of-stock (2):\n"
                "  - Ethanol 70%: 0 mL (out_of_stock, Shelf A)"
            ),
        },
        {
            "title": "Tasks",
            "content": (
                "Open tasks (1):\n"
                "  - [LOW] Update MSDS binders — Unassigned, status=todo"
            ),
        },
    ],
}


async def run_copilot_case(case: dict) -> tuple[bool, str, int]:
    role = case.get("user_role", "researcher")
    context = DUMMY_CONTEXT.get(role, DUMMY_CONTEXT["researcher"])
    result = await generate_copilot_answer(
        question=case["question"],
        context_sections=context,
        user_role=role,
    )
    passed, reason = _check(result["answer"], result["was_refused"], case)
    return passed, reason, result.get("tokens_used") or 0


# ── RAG eval ──────────────────────────────────────────────────────────────────

DUMMY_RAG_CHUNKS: dict[str, list[dict]] = {
    "on_topic": [
        {
            "document_title": "Cell Culture SOP",
            "chunk_index": 0,
            "content": (
                "Cell Culture Medium Preparation:\n"
                "1. Combine DMEM base medium with 10% FBS and 1% penicillin/streptomycin.\n"
                "2. Filter sterilize through a 0.22 µm membrane under laminar flow hood.\n"
                "3. Store at 4°C for up to 4 weeks. Pre-warm to 37°C before use.\n"
                "Always work under sterile conditions and label with preparation date."
            ),
            "similarity": 0.91,
        }
    ],
    "safety": [
        {
            "document_title": "Lab Safety Policy",
            "chunk_index": 2,
            "content": (
                "Chemical Spill Response:\n"
                "1. Alert nearby personnel immediately.\n"
                "2. For minor spills: don appropriate PPE, use spill kit to absorb material.\n"
                "3. For major spills or unknown chemicals: evacuate, call emergency services.\n"
                "4. Rinse any skin contact with water for 15 minutes. Report all spills to PI."
            ),
            "similarity": 0.88,
        }
    ],
    "onboarding": [
        {
            "document_title": "New Member Onboarding Checklist",
            "chunk_index": 0,
            "content": (
                "First-Week Checklist:\n"
                "- Complete lab safety training (required before bench work)\n"
                "- Review all SOPs relevant to your project\n"
                "- Complete orientation meeting with PI\n"
                "- Get access to shared lab calendar and LIMS\n"
                "- Review emergency procedures and evacuation routes"
            ),
            "similarity": 0.87,
        }
    ],
}

RAG_CHUNK_ROUTING: dict[str, str | None] = {
    "rag_01": "on_topic",
    "rag_02": "safety",
    "rag_03": None,   # no chunks → refusal (pi_only doc filtered out)
    "rag_04": "on_topic",  # will still redirect because question is about live data
    "rag_05": None,   # no relevant chunks
    "rag_06": "onboarding",
    "rag_07": None,   # injection attempt
}


async def run_rag_case(case: dict) -> tuple[bool, str, int]:
    chunk_key = RAG_CHUNK_ROUTING.get(case["id"])
    chunks = DUMMY_RAG_CHUNKS[chunk_key] if chunk_key else []
    result = await answer_question(
        question=case["question"],
        retrieved_chunks=chunks,
    )
    passed, reason = _check(result["answer"], result["was_refused"], case)
    return passed, reason, result.get("tokens_used") or 0


# ── Runner ────────────────────────────────────────────────────────────────────

async def main(system_filter: str | None, id_filter: str | None) -> None:
    if not EVAL_FILE.exists():
        print(f"Error: eval file not found at {EVAL_FILE}")
        sys.exit(1)

    with open(EVAL_FILE) as f:
        evals = json.load(f)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not set in backend/.env")
        sys.exit(1)

    systems = evals["systems"]
    total_pass = total_fail = 0

    for system_name, system_data in systems.items():
        if system_filter and system_filter != system_name:
            continue

        _bar(f"System: {system_name.upper()}  —  {system_data['description']}")

        for case in system_data["cases"]:
            if id_filter and id_filter != case["id"]:
                continue

            try:
                if system_name == "copilot":
                    passed, reason, tokens = await run_copilot_case(case)
                elif system_name == "rag_assistant":
                    passed, reason, tokens = await run_rag_case(case)
                else:
                    print(f"  ? SKIP  [{case['id']}] Unknown system: {system_name}")
                    continue
            except Exception as exc:
                passed, reason, tokens = False, f"Exception: {exc}", 0

            _result_line(case["id"], case["name"], passed, reason, tokens)
            if passed:
                total_pass += 1
            else:
                total_fail += 1

    _bar("SUMMARY")
    total = total_pass + total_fail
    pct = int(100 * total_pass / total) if total else 0
    print(f"  Passed: {total_pass}/{total}  ({pct}%)")
    if total_fail:
        print(f"  Failed: {total_fail}/{total}")
    print()

    if total_fail:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run ALMA LabOps basic AI evals")
    parser.add_argument("--system", choices=["rag", "rag_assistant", "copilot"], default=None,
                        help="Run only this system's evals (rag or copilot)")
    parser.add_argument("--id", dest="case_id", default=None,
                        help="Run only this specific case ID (e.g. cop_01)")
    args = parser.parse_args()

    # Normalize alias
    system_arg = args.system
    if system_arg == "rag":
        system_arg = "rag_assistant"

    asyncio.run(main(system_arg, args.case_id))
