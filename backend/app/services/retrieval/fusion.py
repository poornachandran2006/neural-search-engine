from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def reciprocal_rank_fusion(
    dense_results: list[dict],
    sparse_results: list[dict],
    k: int = None,
) -> list[dict]:
    """
    Reciprocal Rank Fusion merges two ranked lists without requiring
    score normalization across different scales.

    Formula: RRF(d) = Σ 1 / (k + rank_i)
    where rank_i is the 1-based position in each list.
    k=60 is the standard constant from the original RRF paper (Cormack 2009).

    Why this works: a document ranked #1 in both lists gets
    1/(60+1) + 1/(60+1) ≈ 0.033. A document ranked #20 in both gets
    1/(60+20) + 1/(60+20) ≈ 0.025. The difference is small but consistent,
    which prevents outlier scores from dominating.
    """
    k = k or settings.rrf_k  # 60

    # Map point ID → RRF score accumulator
    rrf_scores: dict[int, float] = {}
    # Map point ID → chunk data (dense results have full metadata)
    chunk_map: dict[int, dict] = {}

    # Score dense results
    for rank, chunk in enumerate(dense_results, start=1):
        doc_id = chunk["id"]
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (k + rank)
        chunk_map[doc_id] = chunk

    # Score sparse results — add to existing score if already in dense
    for rank, chunk in enumerate(sparse_results, start=1):
        doc_id = chunk["id"]
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (k + rank)
        # Only add to chunk_map if not already there (dense has better metadata)
        if doc_id not in chunk_map:
            chunk_map[doc_id] = chunk

    # Sort by RRF score descending
    sorted_ids = sorted(rrf_scores.keys(), key=lambda i: rrf_scores[i], reverse=True)

    fused = []
    for doc_id in sorted_ids:
        chunk = chunk_map[doc_id].copy()
        chunk["rrf_score"] = rrf_scores[doc_id]
        fused.append(chunk)

    logger.info(
        "rrf_fusion_complete",
        dense_count=len(dense_results),
        sparse_count=len(sparse_results),
        fused_count=len(fused),
    )
    return fused