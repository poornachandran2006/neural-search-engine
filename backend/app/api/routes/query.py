import asyncio
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import get_logger
from app.db.postgres import get_db
from app.db.redis_cache import make_cache_key, get_cached_response, set_cached_response
from app.models.orm import Chat, Message
from app.models.request import QueryRequest
from app.services.query.pipeline import run_query_pipeline
from app.services.rag.generator import stream_answer
from app.services.rag.map_reduce import stream_map_reduce
from app.services.rag.safety import has_sufficient_context, stream_fallback

logger = get_logger(__name__)
router = APIRouter(prefix="/query", tags=["query"])


@router.post("/pipeline")
async def query_pipeline_debug(request: QueryRequest):
    result = await run_query_pipeline(request.query)
    formatted_chunks = [
        {
            "source_file": c.get("source_file", ""),
            "page_number": c.get("page_number", 0),
            "chunk_index": c.get("chunk_index", 0),
            "rerank_score": round(float(c.get("rerank_score", 0.0)), 4),
            "rrf_score": round(float(c.get("rrf_score", 0.0)), 6),
            "text_preview": c.get("text", "")[:200],
        }
        for c in result["chunks"]
    ]
    return {
        "normalized_query": result["normalized_query"],
        "rewritten_query": result["rewritten_query"],
        "intent": result["intent"],
        "confidence": result["confidence"],
        "is_multi_doc": result["is_multi_doc"],
        "source_files": result["source_files"],
        "chunks": formatted_chunks,
        "chunk_count": len(formatted_chunks),
    }


@router.post("/stream")
async def query_stream(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Production RAG endpoint with conversational memory and pipeline status events.

    SSE event types:
      data: [STATUS]{...}    — live pipeline step progress
      data: [META]{...}      — pipeline metadata (intent, sources, chat_id)
      data: {token}          — answer tokens
      data: [SOURCES]{...}   — source chunk cards
      data: [DONE]           — stream complete
    """
    history = [{"role": m.role, "content": m.content} for m in request.history]

    # Ensure chat session exists
    chat_id = request.chat_id
    if chat_id:
        result = await db.execute(select(Chat).where(Chat.id == chat_id))
        chat = result.scalar_one_or_none()
        if not chat:
            chat_id = None

    if not chat_id:
        chat = Chat(title=request.query[:60])
        db.add(chat)
        await db.commit()
        await db.refresh(chat)
        chat_id = chat.id

    # Save user message immediately
    user_msg = Message(
        chat_id=chat_id,
        role="user",
        content=request.query,
    )
    db.add(user_msg)
    await db.commit()

    async def event_stream():
        nonlocal db

        # Create status queue — pipeline writes to it, we read and emit as SSE
        status_queue: asyncio.Queue = asyncio.Queue()

        # Run pipeline concurrently with status event emission
        pipeline_task = asyncio.create_task(
            run_query_pipeline(request.query, status_queue=status_queue)
        )

        # Drain status events until pipeline completes
        while not pipeline_task.done():
            try:
                status = await asyncio.wait_for(status_queue.get(), timeout=0.1)
                yield f"data: [STATUS]{json.dumps(status)}\n\n"
            except asyncio.TimeoutError:
                continue

        # Drain any remaining status events after pipeline finishes
        while not status_queue.empty():
            status = status_queue.get_nowait()
            yield f"data: [STATUS]{json.dumps(status)}\n\n"

        pipeline_result = await pipeline_task
        chunks = pipeline_result["chunks"]
        intent = pipeline_result["intent"]
        is_multi_doc = pipeline_result["is_multi_doc"]
        normalized = pipeline_result["normalized_query"]
        rewritten = pipeline_result["rewritten_query"]

        sources = [
            {
                "source_file": c.get("source_file", ""),
                "page_number": c.get("page_number", 0),
                "chunk_index": c.get("chunk_index", 0),
                "rerank_score": round(float(c.get("rerank_score", 0.0)), 4),
                "text_preview": c.get("text", "")[:200],
            }
            for c in chunks
            if float(c.get("rerank_score", 0.0)) >= 0.05
        ]

        cache_key = make_cache_key(normalized, rewritten)
        cached = await get_cached_response(cache_key)

        if cached:
            logger.info("serving_from_cache", key=cache_key[:20])
            yield f"data: [META]{json.dumps({'intent': intent, 'rewritten_query': rewritten, 'is_multi_doc': is_multi_doc, 'source_files': pipeline_result['source_files'], 'cached': True, 'chat_id': chat_id})}\n\n"
            # Send cached answer token by token split by sentences to avoid SSE frame breaks
            safe_answer = cached["answer"].replace("\n", " ")
            yield f"data: {safe_answer}\n\n"
            yield f"data: [SOURCES]{json.dumps(cached['sources'])}\n\n"
            yield "data: [DONE]\n\n"

            assistant_msg = Message(
                chat_id=chat_id,
                role="assistant",
                content=cached["answer"],
                sources=cached["sources"],
            )
            db.add(assistant_msg)
            await db.commit()
            return

        if not has_sufficient_context(chunks, intent=intent):
            fallback_text = "I couldn't find relevant information in the uploaded documents to answer this question."
            async for event in stream_fallback():
                yield event
            assistant_msg = Message(
                chat_id=chat_id,
                role="assistant",
                content=fallback_text,
            )
            db.add(assistant_msg)
            await db.commit()
            return

        meta = {
            "intent": intent,
            "rewritten_query": rewritten,
            "is_multi_doc": is_multi_doc,
            "source_files": pipeline_result["source_files"],
            "chat_id": chat_id,
        }
        yield f"data: [META]{json.dumps(meta)}\n\n"

        use_map_reduce = is_multi_doc or intent in ("comparison", "summarization")
        full_answer_parts = []

        generator = stream_map_reduce if use_map_reduce else stream_answer
        async for event in generator(request.query, chunks, history=history):
            if event.startswith("data: [DONE]"):
                break
            token = event.removeprefix("data: ").rstrip("\n")
            full_answer_parts.append(token)
            yield event

        yield "data: [DONE]\n\n"
        yield f"data: [SOURCES]{json.dumps(sources)}\n\n"

        full_answer = "".join(full_answer_parts)

        assistant_msg = Message(
            chat_id=chat_id,
            role="assistant",
            content=full_answer,
            sources=sources,
        )
        db.add(assistant_msg)
        await db.commit()

        await set_cached_response(cache_key, {"answer": full_answer, "sources": sources})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )