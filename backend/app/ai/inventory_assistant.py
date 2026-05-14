"""Inventory AI assistant — answers natural language questions about lab inventory."""
from app.ai.client import get_openai_client


async def query_inventory(prompt: str, inventory_context: str) -> str:
    client = get_openai_client()
    response = await client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an operational assistant for a research laboratory. "
                    "Answer questions about inventory clearly and concisely. "
                    "Only reference items present in the provided inventory context. "
                    "Do not invent items or quantities."
                ),
            },
            {
                "role": "user",
                "content": f"Inventory context:\n{inventory_context}\n\nQuestion: {prompt}",
            },
        ],
        max_tokens=512,
    )
    return response.choices[0].message.content or ""
