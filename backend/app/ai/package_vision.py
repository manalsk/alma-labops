"""Package intake vision AI — deterministic mocked and live OpenAI extraction."""
import json
from typing import Literal

from app.ai.client import get_openai_client

# ── Deterministic mock responses for seeded demo packages ─────────────────────
# Keyed by substring that appears in the image URL/path.

MOCK_EXTRACTIONS: dict[str, dict] = {
    "pipette-tips": {
        "item_name": "Pipette Tips 1000μL Filtered",
        "vendor": "Thermo Scientific",
        "quantity": 10,
        "unit": "boxes",
        "catalog_number": "TF-RT-1000F",
        "category": "Consumables",
        "storage_condition": None,
        "confidence": "high",
        "notes": "10 boxes of 96 filtered tips each",
    },
    "ethanol": {
        "item_name": "Ethanol 200 Proof Reagent Grade",
        "vendor": "Sigma-Aldrich",
        "quantity": 4,
        "unit": "bottles",
        "catalog_number": "E7023-1L",
        "category": "Reagents",
        "storage_condition": "Flammable",
        "confidence": "high",
        "notes": "Highly flammable — store away from ignition sources",
    },
    "falcon-tubes": {
        "item_name": "Conical Tubes 15mL",
        "vendor": "VWR",
        "quantity": 500,
        "unit": "units",
        "catalog_number": "89039-666",
        "category": "Consumables",
        "storage_condition": None,
        "confidence": "high",
        "notes": "Polystyrene, sterile, RNase/DNase free",
    },
    "anti-gfp": {
        "item_name": "Anti-GFP Antibody",
        "vendor": "Thermo Scientific",
        "quantity": 1,
        "unit": "vial",
        "catalog_number": "A-11122",
        "category": "Antibodies",
        "storage_condition": "Keep Frozen",
        "confidence": "high",
        "notes": "Rabbit polyclonal, 100μg. Store at -20°C",
    },
    "nitrile-gloves": {
        "item_name": "NITRI-DEX Nitrile Examination Gloves",
        "vendor": "Fisherbrand",
        "quantity": 100,
        "unit": "gloves",
        "catalog_number": "19-130-1597B",
        "category": "PPE",
        "storage_condition": None,
        "confidence": "high",
        "notes": "Size M, powder-free, non-sterile",
    },
}

_FALLBACK_MOCK: dict = {
    "item_name": None,
    "vendor": None,
    "quantity": None,
    "unit": None,
    "catalog_number": None,
    "category": None,
    "storage_condition": None,
    "confidence": "low",
    "notes": "Could not match known package — manual entry required",
}


def mock_extract(image_url: str) -> dict:
    """Return deterministic extraction for known demo packages, fallback otherwise."""
    url_lower = image_url.lower()
    for key, result in MOCK_EXTRACTIONS.items():
        if key in url_lower:
            return dict(result)
    return dict(_FALLBACK_MOCK)


async def live_extract(image_url: str) -> tuple[dict, int]:
    """
    Call GPT-4o Vision to extract structured package metadata.
    Uses the image URL directly (no base64 encoding — cheaper and faster).
    Returns (extraction_dict, tokens_used).
    """
    client = get_openai_client()

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a laboratory package intake assistant. "
                    "Extract structured metadata from package label images. "
                    "Return JSON with exactly these fields (use null if unknown): "
                    "item_name, vendor, quantity (number or null), unit, "
                    "catalog_number, category, storage_condition, "
                    "confidence (high/medium/low), notes."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": image_url, "detail": "low"},
                    },
                    {"type": "text", "text": "Extract package metadata from this label."},
                ],
            },
        ],
        response_format={"type": "json_object"},
        max_tokens=400,
    )

    tokens_used = response.usage.total_tokens if response.usage else 0
    raw = json.loads(response.choices[0].message.content or "{}")
    return raw, tokens_used
