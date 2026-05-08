from typing import AsyncGenerator
from collections import defaultdict
from groq import AsyncGroq
from app.core.config import settings
from app.core.logging import get_logger
from app.services.rag.prompt_builder import build_map_prompt, build_reduce_prompt

logger = get_logger(__name__)

_client = AsyncGroq(api_key=settings.groq_api_key)

_CHUNKS_PER_DOC = 3


async def _call_groq(messages: list[dict]) -> str:
    """Async Groq call for MAP steps — one per document."""
    response = await _client.chat.completions.create(
        model=settings.groq_model,
        messages=messages,
        temperature=settings.llm_temperature,
        max_tokens=512,
        stream=False,
    )
    return response.choices[0].message.content.strip()


async def stream_map_reduce(
    query: str,
    chunks: list[dict],
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Map-Reduce RAG for multi-document or summarization queries.

    MAP: For each unique source document, take top-3 chunks from that doc
         and run a focused Groq call to extract relevant information.

    REDUCE: Feed all per-document answers into a final Groq call that
            synthesizes them into one coherent response, streamed via SSE.
    """
    doc_chunks: dict[str, list[dict]] = defaultdict(list)
    for chunk in chunks:
        source = chunk.get("source_file", "unknown")
        doc_chunks[source].append(chunk)

    logger.info(
        "map_reduce_started",
        query=query[:60],
        documents=list(doc_chunks.keys()),
    )

    # MAP step — one async Groq call per document
    per_doc_answers = []
    for source_file, doc_chunk_list in doc_chunks.items():
        top_chunks = sorted(
            doc_chunk_list,
            key=lambda c: c.get("rerank_score", 0.0),
            reverse=True,
        )[:_CHUNKS_PER_DOC]

        try:
            messages = build_map_prompt(query, top_chunks, source_file)
            answer = await _call_groq(messages)
            per_doc_answers.append({
                "source_file": source_file,
                "answer": answer,
            })
            logger.info("map_step_complete", source=source_file)
        except Exception as e:
            logger.error("map_step_failed", source=source_file, error=str(e))
            continue

    if not per_doc_answers:
        yield "data: Could not extract answers from any document.\n\n"
        yield "data: [DONE]\n\n"
        return

    # REDUCE step — stream the final merged answer
    reduce_messages = build_reduce_prompt(query, per_doc_answers, history=history or [])

    try:
        stream = await _client.chat.completions.create(
            model=settings.groq_model,
            messages=reduce_messages,
            temperature=settings.llm_temperature,
            max_tokens=1024,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield f"data: {delta.content}\n\n"

        yield "data: [DONE]\n\n"
        logger.info("map_reduce_complete", docs=len(per_doc_answers))

    except Exception as e:
        logger.error("reduce_step_failed", error=str(e))
        yield f"data: Error in reduce step: {str(e)}\n\n"
        yield "data: [DONE]\n\n"