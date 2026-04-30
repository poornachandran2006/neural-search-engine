from app.core.config import settings
from app.core.logging import get_logger
from app.services.ingestion.pipeline import load_bm25_index
from app.db.qdrant import get_qdrant_client

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

    # Collect IDs with positive scores
    result_ids = []
    result_scores = {}
    for rank, idx in enumerate(top_indices):
        if scores[idx] <= 0:
            break
        point_id = ids[idx]
        result_ids.append(point_id)
        result_scores[point_id] = float(scores[idx])

    if not result_ids:
        return []

    # Fetch full metadata from Qdrant for matched IDs
    client = get_qdrant_client()
    points = client.retrieve(
        collection_name=settings.qdrant_collection,
        ids=result_ids,
        with_payload=True,
        with_vectors=False,
    )

    # Build a lookup so we preserve BM25 rank order
    point_map = {p.id: p for p in points}

    chunks = []
    for rank, point_id in enumerate(result_ids):
        if point_id not in point_map:
            continue
        payload = point_map[point_id].payload or {}
        chunks.append({
            "id": point_id,
            "score": result_scores[point_id],
            "text": payload.get("text", ""),
            "source_file": payload.get("source_file", ""),
            "page_number": payload.get("page_number", 0),
            "chunk_index": payload.get("chunk_index", 0),
            "sha256": payload.get("sha256", ""),
            "bm25_rank": rank,
        })

    logger.info(
        "sparse_retrieval_complete",
        query=query[:60],
        returned=len(chunks),
    )
    return chunks