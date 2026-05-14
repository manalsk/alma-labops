"""RAG assistant — grounded knowledge base Q&A using pgvector retrieval."""
from app.ai.client import get_openai_client


async def generate_embedding(text: str) -> list[float]:
    """Generate an embedding vector for semantic search."""
    client = get_openai_client()
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


async def answer_with_context(question: str, retrieved_chunks: list[dict]) -> dict:
    """Generate a grounded answer from retrieved document chunks."""
    client = get_openai_client()

    context = "\n\n---\n\n".join(
        f"Source: {chunk.get('document_title', 'Unknown')}\n{chunk.get('content', '')}"
        for chunk in retrieved_chunks
    )

    response = await client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a laboratory knowledge base assistant. "
                    "Answer questions using ONLY the provided document context. "
                    "Always cite the source document. "
                    "If the answer is not in the context, say so explicitly."
                ),
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}",
            },
        ],
        max_tokens=1024,
    )

    return {
        "answer": response.choices[0].message.content or "",
        "sources": [c.get("document_title") for c in retrieved_chunks],
    }
