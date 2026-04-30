from qdrant_client import QdrantClient, AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    HnswConfigDiff,
    OptimizersConfigDiff,
    PayloadSchemaType,
)
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Module-level singletons — initialized once, reused everywhere
_sync_client: QdrantClient | None = None
_async_client: AsyncQdrantClient | None = None


def get_qdrant_client() -> QdrantClient:
    global _sync_client
    if _sync_client is None:
        _sync_client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
            timeout=30,
        )
    return _sync_client


def get_async_qdrant_client() -> AsyncQdrantClient:
    global _async_client
    if _async_client is None:
        _async_client = AsyncQdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
            timeout=30,
        )
    return _async_client


async def init_qdrant_collection() -> None:
    """
    Idempotent collection setup — safe to call on every startup.
    Creates the collection only if it does not already exist.
    """
    client = get_qdrant_client()
    collection_name = settings.qdrant_collection

    existing = {c.name for c in client.get_collections().collections}

    if collection_name in existing:
        logger.info("qdrant_collection_exists", collection=collection_name)
        return

    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(
            size=settings.embedding_dim,   # 768 for Gemini text-embedding-004
            distance=Distance.COSINE,
        ),
        hnsw_config=HnswConfigDiff(
            m=16,             # edges per node — higher = better recall, more RAM
            ef_construct=200, # candidates during index build — higher = better quality
            full_scan_threshold=10_000,
        ),
        optimizers_config=OptimizersConfigDiff(
            indexing_threshold=20_000,  # delay heavy indexing until 20k vectors
        ),
    )

    # Create payload indexes for fast metadata filtering
    client.create_payload_index(
        collection_name=collection_name,
        field_name="source_file",
        field_schema=PayloadSchemaType.KEYWORD,
    )
    client.create_payload_index(
        collection_name=collection_name,
        field_name="sha256",
        field_schema=PayloadSchemaType.KEYWORD,
    )

    logger.info(
        "qdrant_collection_created",
        collection=collection_name,
        dims=settings.embedding_dim,
        distance="cosine",
    )


async def close_qdrant_clients() -> None:
    global _sync_client, _async_client
    if _sync_client:
        _sync_client.close()
        _sync_client = None
    if _async_client:
        await _async_client.close()
        _async_client = None