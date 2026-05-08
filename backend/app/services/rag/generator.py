from typing import AsyncGenerator
from groq import AsyncGroq
from app.core.config import settings
from app.core.logging import get_logger
from app.services.rag.prompt_builder import build_single_doc_prompt

logger = get_logger(__name__)

_client = AsyncGroq(api_key=settings.groq_api_key)


async def stream_answer(
    query: str,
    chunks: list[dict],
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Single-doc RAG generation with SSE token streaming.

    Yields strings in SSE format: 'data: {token}\\n\\n'
    The final event is always: 'data: [DONE]\\n\\n'
    """
    messages = build_single_doc_prompt(query, chunks, history=history or [])

    logger.info(
        "generation_started",
        query=query[:60],
        chunks=len(chunks),
        mode="single_doc",
    )

    try:
        stream = await _client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            temperature=settings.llm_temperature,
            max_tokens=1024,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                token = delta.content
                yield f"data: {token}\n\n"

        yield "data: [DONE]\n\n"
        logger.info("generation_complete", mode="single_doc")

    except Exception as e:
        logger.error("generation_failed", error=str(e))
        yield f"data: Error generating response: {str(e)}\n\n"
        yield "data: [DONE]\n\n"