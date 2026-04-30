import re
from app.core.logging import get_logger

logger = get_logger(__name__)


def normalize_query(query: str) -> str:
    """
    Cleans raw user input before any LLM or retrieval call.
    Order matters — each step builds on the previous.
    """
    # Strip leading/trailing whitespace
    query = query.strip()

    # Collapse multiple whitespace/newlines into single space
    query = re.sub(r"\s+", " ", query)

    # Remove characters that break tokenizers or prompt injection attempts
    query = re.sub(r"[^\w\s\?\.\,\!\-\'\"\(\)\:]", " ", query)

    # Lowercase for consistent embedding and BM25 matching
    query = query.lower()

    # Final strip after all replacements
    query = query.strip()

    logger.debug("query_normalized", result=query)
    return query