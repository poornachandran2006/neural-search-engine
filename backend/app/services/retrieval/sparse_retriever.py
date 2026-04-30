from app.core.config import settings
from app.core.logging import get_logger
from app.services.ingestion.pipeline import load_bm25_index

logger = get_logger(__name__)


def sparse_retrieve(query: str, top_k: int = None) -> list[dict]:
    """
    BM25 keyword search over the in-memory index built during ingestion.
    Returns results in the same format as dense_retrieve for RRF fusion.
    """
    top_k = top_k or settings.retrieval_top_k  # default 20

    index_data = load_bm25_index()
    if index_data is None:
        logger.warning("bm25_index_not_found", reason="no_documents_ingested_yet")
        return []

    bm25 = index_data["bm25"]
    texts = index_data["texts"]
    ids = index_data["ids"]

    tokenized_query = query.lower().split()
    scores = bm25.get_scores(tokenized_query)

    # Get top_k indices sorted by score descending
    top_indices = sorted(
        range(len(scores)),
        key=lambda i: scores[i],
        reverse=True,
    )[:top_k]

    chunks = []
    for rank, idx in enumerate(top_indices):
        if scores[idx] <= 0:
            break  # BM25 score of 0 means no keyword overlap — skip
        chunks.append({
            "id": ids[idx],
            "score": float(scores[idx]),
            "text": texts[idx],
            "source_file": "",   # BM25 index doesn't store metadata — filled by reranker
            "page_number": 0,
            "chunk_index": 0,
            "sha256": "",
            "bm25_rank": rank,
        })

    logger.info(
        "sparse_retrieval_complete",
        query=query[:60],
        returned=len(chunks),
    )
    return chunks