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


async def run_query_pipeline(raw_query: str) -> dict:
    """
    Orchestrates all 7 pre-generation steps of the query pipeline.
    All blocking I/O (Groq API, Qdrant, FlashRank) runs in a thread
    pool via asyncio.to_thread() so the event loop stays free.
    """
    logger.info("query_pipeline_started", query=raw_query[:80])

    # Step 1: Normalize (pure CPU — fast, no thread needed)
    normalized = normalize_query(raw_query)

    # Step 2 & 3: Intent detection and query rewriting run concurrently
    # Both are Groq API calls — parallelizing them saves ~1 second
    intent_result, rewritten = await asyncio.gather(
        asyncio.to_thread(detect_intent, normalized),
        asyncio.to_thread(rewrite_query, normalized, "content"),  # temp intent
    )
    intent = intent_result["intent"]
    confidence = intent_result["confidence"]

    # Re-rewrite with correct intent if it differs from "content"
    if intent != "content":
        rewritten = await asyncio.to_thread(rewrite_query, normalized, intent)

    # Step 4 & 5: Dense and sparse retrieval run concurrently
    dense_chunks, sparse_chunks = await asyncio.gather(
        asyncio.to_thread(dense_retrieve, rewritten),
        asyncio.to_thread(sparse_retrieve, rewritten),
    )

    # Step 6: RRF Fusion (pure CPU — fast, no thread needed)
    fused_chunks = reciprocal_rank_fusion(dense_chunks, sparse_chunks)
    candidates = fused_chunks[:20]

    # Step 7: Rerank in thread pool (FlashRank is CPU-bound)
    if intent in ("summarization", "comparison"):
        final_chunks = candidates[:5]
        for chunk in final_chunks:
            chunk.setdefault("rerank_score", chunk.get("rrf_score", 0.1))
    else:
        final_chunks = await asyncio.to_thread(rerank, rewritten, candidates)

    # Determine multi-doc — only count documents with meaningful rerank scores.
    # A chunk scoring below 0.05 is noise from BM25/RRF and should not trigger
    # map-reduce, which costs 2 extra Groq calls.
    _MULTI_DOC_SCORE_THRESHOLD = 0.05
    source_files = {c["source_file"] for c in final_chunks if c.get("source_file")}
    contributing_sources = {
        c["source_file"]
        for c in final_chunks
        if c.get("source_file") and float(c.get("rerank_score", 0.0)) >= _MULTI_DOC_SCORE_THRESHOLD
    }
    is_multi_doc = len(contributing_sources) > 1

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