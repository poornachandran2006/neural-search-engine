from flashrank import Ranker, RerankRequest
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Load the cross-encoder model once at module level
# ms-marco-MiniLM-L-12-v2 is the best FlashRank model for retrieval reranking
_ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2", cache_dir="/tmp/flashrank")


def rerank(query: str, chunks: list[dict], top_n: int = None) -> list[dict]:
    """
    Cross-encoder reranking using FlashRank (local, no API cost).

    Unlike bi-encoder embeddings (which encode query and document separately),
    a cross-encoder sees the query and document TOGETHER, allowing it to model
    their interaction directly. This gives much better relevance scoring
    but is too slow to run on the full corpus — so we run it only on the
    top-20 fused results from RRF.

    FlashRank runs in ~100ms on CPU for 20 documents.
    """
    top_n = top_n or settings.reranker_top_n  # 5

    if not chunks:
        return []

    # FlashRank expects passages as list of dicts with "id", "text", "meta"
    passages = [
        {
            "id": i,
            "text": chunk["text"],
            "meta": chunk,  # carry full chunk data through
        }
        for i, chunk in enumerate(chunks)
    ]

    rerank_request = RerankRequest(query=query, passages=passages)
    results = _ranker.rerank(rerank_request)

    # Results are already sorted by cross-encoder score descending
    reranked = []
    for result in results[:top_n]:
        chunk = result["meta"].copy()
        chunk["rerank_score"] = float(result["score"])
        chunk["rrf_score"] = float(chunk.get("rrf_score", 0.0))
        chunk["score"] = float(chunk.get("score", 0.0))
        reranked.append(chunk)

    logger.info(
        "reranking_complete",
        input_count=len(chunks),
        output_count=len(reranked),
        top_score=reranked[0]["rerank_score"] if reranked else 0,
    )
    return reranked