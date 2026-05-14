"""Package intake vision AI — extracts structured metadata from package images."""
import base64

from app.ai.client import get_openai_client

EXTRACTION_SCHEMA = {
    "item_name": "string",
    "vendor": "string",
    "quantity": "number",
    "unit": "string",
    "catalog_number": "string",
    "category": "string",
    "notes": "string",
}


async def extract_package_metadata(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """Use GPT-4o Vision to extract structured metadata from a package image."""
    client = get_openai_client()

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a laboratory package intake assistant. "
                    "Extract structured information from package labels and shipping documents. "
                    f"Return JSON matching this schema: {EXTRACTION_SCHEMA}. "
                    "Use null for fields you cannot determine from the image."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{b64_image}"},
                    },
                    {"type": "text", "text": "Extract package metadata from this image."},
                ],
            },
        ],
        response_format={"type": "json_object"},
        max_tokens=512,
    )
    import json
    return json.loads(response.choices[0].message.content or "{}")
