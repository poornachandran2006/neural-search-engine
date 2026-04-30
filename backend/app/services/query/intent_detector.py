import json
import re
from groq import Groq
from app.core.config import settings
from app.core.logging import get_logger
from app.core.exceptions import LLMError

logger = get_logger(__name__)

_client = Groq(api_key=settings.groq_api_key)

# Exactly 4 valid intent classes
VALID_INTENTS = {"metadata", "content", "comparison", "summarization"}

_SYSTEM_PROMPT = """You are a query intent classifier for a document search system.
Classify the user query into exactly one of these four categories:

- metadata: asking about document properties (page count, author, date, file name, document list)
- content: asking for specific facts or information from document content
- comparison: asking to compare, contrast, or find differences across multiple documents
- summarization: asking for a summary, overview, or broad description of document(s)

Respond with a single JSON object and nothing else:
{"intent": "<one of: metadata|content|comparison|summarization>", "confidence": <0.0-1.0>}

No explanation. No markdown. No extra text. Only the JSON object."""


def detect_intent(query: str) -> dict:
    """
    Calls Groq to classify query intent.
    Returns {"intent": str, "confidence": float}.
    Falls back to "content" on any failure — safest default.
    """
    try:
        response = _client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            temperature=0.0,
            max_tokens=64,
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if model adds them despite instructions
        if raw.startswith("```"):
            raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()

        result = json.loads(raw)
        intent = result.get("intent", "content").lower()
        confidence = float(result.get("confidence", 1.0))

        if intent not in VALID_INTENTS:
            logger.warning("invalid_intent_received", raw=intent)
            intent = "content"

        logger.info("intent_detected", intent=intent, confidence=confidence, query=query[:60])
        return {"intent": intent, "confidence": confidence}

    except Exception as e:
        logger.error("intent_detection_failed", error=str(e), query=query[:60])
        return {"intent": "content", "confidence": 0.5}
