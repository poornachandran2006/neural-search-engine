import time
from app.core.config import settings
from app.core.logging import get_logger
from app.core.exceptions import EmbeddingError

import google.generativeai as genai

logger = get_logger(__name__)

genai.configure(api_key=settings.gemini_api_key)

_BATCH_SIZE = 5          # reduced from 50 — free tier is strict
_RETRY_ATTEMPTS = 3
_RETRY_BASE_DELAY = 60   # seconds — wait 60s on rate limit hit


def _embed_batch_with_retry(batch: list[str], task_type: str) -> list[list[float]]:
    for attempt in range(_RETRY_ATTEMPTS):
        try:
            result = genai.embed_content(
                model=settings.embedding_model,
                content=batch,
                task_type=task_type,
            )
            embeddings = result["embedding"]
            if isinstance(embeddings[0], float):
                embeddings = [embeddings]
            return embeddings
        except Exception as e:
            error_str = str(e)
            if "429" in error_str and attempt < _RETRY_ATTEMPTS - 1:
                wait = _RETRY_BASE_DELAY * (attempt + 1)
                logger.warning("rate_limit_hit", attempt=attempt + 1, wait_seconds=wait)
                time.sleep(wait)
            else:
                raise EmbeddingError(error_str) from e
    raise EmbeddingError("Max retries exceeded")


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    all_embeddings: list[list[float]] = []
    total_batches = (len(texts) + _BATCH_SIZE - 1) // _BATCH_SIZE

    for batch_start in range(0, len(texts), _BATCH_SIZE):
        batch = texts[batch_start: batch_start + _BATCH_SIZE]
        batch_num = batch_start // _BATCH_SIZE + 1

        logger.info("embedding_batch", batch=batch_num, total=total_batches, size=len(batch))

        embeddings = _embed_batch_with_retry(batch, "retrieval_document")
        all_embeddings.extend(embeddings)

        # Always pause between batches to respect RPM limit
        if batch_start + _BATCH_SIZE < len(texts):
            time.sleep(2)

    logger.info("embedding_complete", total_vectors=len(all_embeddings))
    return all_embeddings


def embed_query(query: str) -> list[float]:
    try:
        result = genai.embed_content(
            model=settings.embedding_model,
            content=query,
            task_type="retrieval_query",
        )
        embedding = result["embedding"]
        if isinstance(embedding[0], float):
            return embedding
        return embedding[0]
    except Exception as e:
        raise EmbeddingError(str(e)) from e