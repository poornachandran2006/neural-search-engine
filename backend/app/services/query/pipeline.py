import asyncio
from app.core.logging import get_logger
from app.services.query.normalizer import normalize_query
from app.services.query.intent_detector import detect_intent
from app.services.query.rewriter import rewrite_query
from app.services.retrieval.dense_retriever import dense_retrieve
from app.services.retrieval.sparse_retriever import sparse_retrieve
from app.services.retrieval.fusion import reciprocal_rank_fusion
from app.services.retrieval.reranker import rerank

logger = get_logger(__name__)

_MULTI_DOC_SCORE_THRESHOLD = 0.05


async def run_query_pipeline(
    raw_query: str,
    status_queue: asyncio.Queue | None = None,
) -> dict:
    """
    Orchestrates all 7 pre-generation steps of the query pipeline.
    If status_queue is provided, emits status dicts after each step
    so the caller can stream live pipeline progress to the frontend.
    """

    async def emit(step: str, label: str, done: bool = True):
        if status_queue is not None:
            await status_queue.put({"step": step, "label": label, "done": done})

    logger.info("query_pipeline_started", query=raw_query[:80])

    # Step 1: Normalize
    await emit("normalize", "Normalizing query...", done=False)
    normalized = normalize_query(raw_query)
    await emit("normalize", "Query normalized", done=True)

    # Step 2 & 3: Intent detection and query rewriting (concurrent Groq calls)
    await emit("intent", "Detecting intent...", done=False)
    intent_result, rewritten = await asyncio.gather(
        asyncio.to_thread(detect_intent, normalized),
        asyncio.to_thread(rewrite_query, normalized, "content"),
    )
    intent = intent_result["intent"]
    confidence = intent_result["confidence"]
    await emit("intent", f"Intent: {intent}", done=True)

    # Re-rewrite with correct intent if it differs from "content"
    if intent != "content":
        await emit("rewrite", "Rewriting query...", done=False)
        rewritten = await asyncio.to_thread(rewrite_query, normalized, intent)
        await emit("rewrite", "Query rewritten", done=True)
    else:
        await emit("rewrite", "Query rewritten", done=True)

    # Step 4 & 5: Dense and sparse retrieval (concurrent)
    await emit("retrieve", "Retrieving chunks...", done=False)
    dense_chunks, sparse_chunks = await asyncio.gather(
        asyncio.to_thread(dense_retrieve, rewritten),
        asyncio.to_thread(sparse_retrieve, rewritten),
    )

    # Step 6: RRF Fusion
    fused_chunks = reciprocal_rank_fusion(dense_chunks, sparse_chunks)
    candidates = fused_chunks[:20]
    await emit("retrieve", f"{len(candidates)} candidates fused", done=True)

    # Step 7: Rerank
    await emit("rerank", "Reranking...", done=False)
    if intent in ("summarization", "comparison"):
        final_chunks = candidates[:5]
        for chunk in final_chunks:
            chunk.setdefault("rerank_score", chunk.get("rrf_score", 0.1))
    else:
        final_chunks = await asyncio.to_thread(rerank, rewritten, candidates)
    await emit("rerank", f"Top {len(final_chunks)} chunks selected", done=True)

    # Determine multi-doc
    source_files = {c["source_file"] for c in final_chunks if c.get("source_file")}
    contributing_sources = {
        c["source_file"]
        for c in final_chunks
        if c.get("source_file") and float(c.get("rerank_score", 0.0)) >= _MULTI_DOC_SCORE_THRESHOLD
    }
    is_multi_doc = len(contributing_sources) > 1

    await emit("generate", "Generating answer...", done=False)

    logger.info(
        "query_pipeline_complete",
        intent=intent,
        chunks_returned=len(final_chunks),
        is_multi_doc=is_multi_doc,
        sources=list(source_files),
    )

    return {
        "normalized_query": normalized,
        "rewritten_query": rewritten,
        "intent": intent,
        "confidence": confidence,
        "chunks": final_chunks,
        "is_multi_doc": is_multi_doc,
        "source_files": list(contributing_sources),
    }