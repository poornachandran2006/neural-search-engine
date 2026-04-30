from groq import Groq
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_client = Groq(api_key=settings.groq_api_key)

_SYSTEM_PROMPT = """You are a search query optimizer for a vector database retrieval system.
Rewrite the user query to maximize retrieval recall from a document corpus.

Rules:
- Convert conversational language to keyword-dense, noun-heavy phrases
- Expand abbreviations and acronyms
- Remove filler words (what, does, it, say, about, the, is, there)
- Preserve all domain-specific terms exactly
- Return ONLY the rewritten query string — no explanation, no punctuation at the end
- If the query is already optimal, return it unchanged

Examples:
Input:  "what does it say about leaving early?"
Output: "employee early departure policy procedures termination"

Input:  "how many pages does the document have?"
Output: "document page count total pages"

Input:  "compare the two contracts on payment terms"
Output: contract payment terms comparison differences clauses"""


def rewrite_query(query: str, intent: str) -> str:
    """
    Rewrites the normalized query into a retrieval-optimized form.
    For metadata intent, rewriting is less critical but still applied.
    Returns the rewritten string, falls back to original on failure.
    """
    try:
        response = _client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"Intent: {intent}\nQuery: {query}"},
            ],
            temperature=0.0,
            max_tokens=128,
        )

        rewritten = response.choices[0].message.content.strip()

        # Sanity check — if rewriter returns something too short or empty, use original
        if len(rewritten) < 3:
            return query

        logger.info(
            "query_rewritten",
            original=query[:60],
            rewritten=rewritten[:60],
            intent=intent,
        )
        return rewritten

    except Exception as e:
        logger.error("query_rewrite_failed", error=str(e))
        return query  # always fall back to original