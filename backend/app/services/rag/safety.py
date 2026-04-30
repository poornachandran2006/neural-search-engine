from app.core.logging import get_logger

logger = get_logger(__name__)

_FALLBACK_RESPONSE = (
    "I couldn't find relevant information in the uploaded documents "
    "to answer this question. Please ensure the relevant documents have "
    "been uploaded, or rephrase your question."
)


def has_sufficient_context(chunks: list[dict], threshold: float = 0.05) -> bool:
    """
    Returns True if at least one chunk has a rerank score above threshold.
    The reranker score is more reliable than the embedding similarity score
    because it uses a cross-encoder that sees query+document together.
    """
    if not chunks:
        return False
    return any(c.get("rerank_score", 0.0) >= threshold for c in chunks)


def get_fallback_response() -> str:
    return _FALLBACK_RESPONSE


async def stream_fallback():
    """Yields the fallback as a single SSE event for consistent streaming interface."""
    logger.warning("safety_fallback_triggered")
    yield f"data: {_FALLBACK_RESPONSE}\n\n"
    yield "data: [DONE]\n\n"