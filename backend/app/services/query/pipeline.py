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

    Returns a dict with:
    - normalized_query: str
    - rewritten_query: str
    - intent: str
    - confidence: float
    - chunks: list[dict]  — top-5 reranked chunks ready for RAG
    - is_multi_doc: bool  — True if chunks span multiple source files
    """
    logger.info("query_pipeline_started", query=raw_query[:80])

    # Step 1: Normalize
    normalized = normalize_query(raw_query)

    # Step 2: Detect intent
    intent_result = detect_intent(normalized)
    intent = intent_result["intent"]
    confidence = intent_result["confidence"]

    # Step 3: Rewrite
    rewritten = rewrite_query(normalized, intent)

    # Step 4: Dense retrieval
    dense_chunks = dense_retrieve(rewritten)

    # Step 5: Sparse retrieval
    sparse_chunks = sparse_retrieve(rewritten)

    # Step 6: RRF Fusion
    fused_chunks = reciprocal_rank_fusion(dense_chunks, sparse_chunks)

    # Take top-20 for reranking (or all if fewer)
    candidates = fused_chunks[:20]

    # Step 7: Rerank → top-5
    # For summarization/comparison, cross-encoder scores poorly on abstract queries.
    # Use RRF-ranked chunks directly — they already represent the best coverage.
    if intent in ("summarization", "comparison"):
        final_chunks = candidates[:5]
        for chunk in final_chunks:
            chunk.setdefault("rerank_score", chunk.get("rrf_score", 0.1))
    else:
        final_chunks = rerank(rewritten, candidates)

    # Determine if this is a multi-doc query
    source_files = {c["source_file"] for c in final_chunks if c.get("source_file")}
    is_multi_doc = len(source_files) > 1

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
        "source_files": list(source_files),
    }