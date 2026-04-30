import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.core.logging import get_logger
from app.models.request import QueryRequest
from app.services.query.pipeline import run_query_pipeline
from app.services.rag.generator import stream_answer
from app.services.rag.map_reduce import stream_map_reduce
from app.services.rag.safety import has_sufficient_context, stream_fallback

logger = get_logger(__name__)
router = APIRouter(prefix="/query", tags=["query"])


@router.post("/pipeline")
async def query_pipeline_debug(request: QueryRequest):
    """
    Debug endpoint — runs full pipeline and returns structured JSON.
    Used for testing. Production traffic uses /query/stream.
    """
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
async def query_stream(request: QueryRequest):
    """
    Production RAG endpoint — streams tokens via SSE.

    SSE format:
      data: {token}\\n\\n        <- each token
      data: [SOURCES]{...}\\n\\n  <- source metadata after generation
      data: [DONE]\\n\\n          <- terminal event

    The frontend reads this stream and appends tokens to the message bubble.
    """
    # Step 1: Run the full 7-step retrieval pipeline
    pipeline_result = await run_query_pipeline(request.query)
    chunks = pipeline_result["chunks"]
    intent = pipeline_result["intent"]
    is_multi_doc = pipeline_result["is_multi_doc"]

    # Build source metadata to send after generation
    sources = [
        {
            "source_file": c.get("source_file", ""),
            "page_number": c.get("page_number", 0),
            "chunk_index": c.get("chunk_index", 0),
            "rerank_score": round(float(c.get("rerank_score", 0.0)), 4),
            "text_preview": c.get("text", "")[:200],
        }
        for c in chunks
    ]

    async def event_stream():
        # Safety check — no relevant chunks found
        if not has_sufficient_context(chunks):
            async for event in stream_fallback():
                yield event
            return

        # Send pipeline metadata as first event
        meta = {
            "intent": intent,
            "rewritten_query": pipeline_result["rewritten_query"],
            "is_multi_doc": is_multi_doc,
            "source_files": pipeline_result["source_files"],
        }
        yield f"data: [META]{json.dumps(meta)}\n\n"

        # Choose generation mode based on intent and doc count
        use_map_reduce = is_multi_doc or intent in ("comparison", "summarization")

        if use_map_reduce:
            logger.info("using_map_reduce", intent=intent, is_multi_doc=is_multi_doc)
            async for event in stream_map_reduce(request.query, chunks):
                yield event
        else:
            logger.info("using_single_doc", intent=intent)
            async for event in stream_answer(request.query, chunks):
                yield event

        # Send source cards after generation completes
        yield f"data: [SOURCES]{json.dumps(sources)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
        },
    )