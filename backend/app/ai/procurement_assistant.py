"""Procurement AI assistant — duplicate detection and purchase request assistance."""
from app.ai.client import get_openai_client


async def check_duplicate(
    requested_item: str,
    existing_requests: list[dict],
    inventory_items: list[dict],
) -> dict:
    """Return AI duplicate/stock analysis for a purchase request."""
    client = get_openai_client()

    context = (
        f"Requested item: {requested_item}\n\n"
        f"Existing purchase requests: {existing_requests}\n\n"
        f"Current inventory: {inventory_items}"
    )

    response = await client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a procurement assistant for a research lab. "
                    "Analyze if a new purchase request duplicates an existing request "
                    "or if the item is already in stock. "
                    "Respond with JSON: {flags: [{type, message}], summary: string}"
                ),
            },
            {"role": "user", "content": context},
        ],
        response_format={"type": "json_object"},
        max_tokens=256,
    )
    import json
    return json.loads(response.choices[0].message.content or "{}")
