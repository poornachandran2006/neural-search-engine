from app.core.logging import get_logger

logger = get_logger(__name__)

_FALLBACK_RESPONSE = (
    "I couldn't find relevant information in the uploaded documents "
    "to answer this question. Please ensure the relevant documents have "
    "been uploaded, or rephrase your question."
)


def has_sufficient_context(
    chunks: list[dict],
    threshold: float = 0.05,
    intent: str = "content",
) -> bool:
    """
    Returns True if there is sufficient context to generate an answer.
    Summarization and comparison intents bypass the threshold check —
    if chunks exist, we always attempt generation since the cross-encoder
    scores poorly on abstract queries by design.
    """
    if not chunks:
        return False
    if intent in ("summarization", "comparison"):
        return True
    return any(c.get("rerank_score", 0.0) >= threshold for c in chunks)


def get_fallback_response() -> str:
    return _FALLBACK_RESPONSE


async def stream_fallback():
    """Yields the fallback as a single SSE event for consistent streaming interface."""
    logger.warning("safety_fallback_triggered")
    yield f"data: {_FALLBACK_RESPONSE}\n\n"
    yield "data: [DONE]\n\n"