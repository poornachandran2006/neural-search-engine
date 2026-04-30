from qdrant_client.models import Filter, FieldCondition, MatchValue, SearchParams
from app.core.config import settings
from app.core.logging import get_logger
from app.db.qdrant import get_qdrant_client
from app.services.ingestion.embedder import embed_query

logger = get_logger(__name__)


def dense_retrieve(
    query: str,
    top_k: int = None,
    source_file: str = None,
) -> list[dict]:
    """
    Embeds the query and searches Qdrant by cosine similarity.
    Filters out chunks below the configured score threshold.
    Optionally filters by source_file for single-doc queries.

    Returns list of dicts with keys: id, score, text, source_file,
    page_number, chunk_index, sha256.
    """
    top_k = top_k or settings.retrieval_top_k  # default 20

    query_vector = embed_query(query)
    client = get_qdrant_client()

    # Build optional metadata filter
    search_filter = None
    if source_file:
        search_filter = Filter(
            must=[FieldCondition(
                key="source_file",
                match=MatchValue(value=source_file),
            )]
        )

    results = client.search(
        collection_name=settings.qdrant_collection,
        query_vector=query_vector,
        limit=top_k,
        query_filter=search_filter,
        score_threshold=settings.retrieval_score_threshold,  # 0.65
        search_params=SearchParams(hnsw_ef=128, exact=False),
        with_payload=True,
    )

    chunks = []
    for hit in results:
        chunks.append({
            "id": hit.id,
            "score": hit.score,
            "text": hit.payload.get("text", ""),
            "source_file": hit.payload.get("source_file", ""),
            "page_number": hit.payload.get("page_number", 0),
            "chunk_index": hit.payload.get("chunk_index", 0),
            "sha256": hit.payload.get("sha256", ""),
        })

    logger.info(
        "dense_retrieval_complete",
        query=query[:60],
        returned=len(chunks),
        top_k=top_k,
    )
    return chunks