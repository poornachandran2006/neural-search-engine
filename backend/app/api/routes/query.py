from fastapi import APIRouter
from app.core.logging import get_logger
from app.models.request import QueryRequest
from app.services.query.pipeline import run_query_pipeline

logger = get_logger(__name__)
router = APIRouter(prefix="/query", tags=["query"])


@router.post("/pipeline")
async def query_pipeline(request: QueryRequest):
    """
    Runs the full 7-step query pipeline and returns structured results.
    This endpoint is for testing — the production /query endpoint (Phase 3)
    will stream tokens via SSE.
    """
    result = await run_query_pipeline(request.query)

    # Format chunks for API response
    formatted_chunks = [
        {
            "source_file": c.get("source_file", ""),
            "page_number": c.get("page_number", 0),
            "chunk_index": c.get("chunk_index", 0),
            "rerank_score": round(c.get("rerank_score", 0.0), 4),
            "rrf_score": round(c.get("rrf_score", 0.0), 6),
            "text_preview": c.get("text", "")[:200],
        }
        for c in result["chunks"]
    ]

    return {
        "normalized_query": result["normalized_query"],
        "rewritten_query": result["rewritten_query"],
        "intent": result["intent"],
        "confidence": result["confidence"],
        "is_multi_doc": result["is_multi_doc"],
        "source_files": result["source_files"],
        "chunks": formatted_chunks,
        "chunk_count": len(formatted_chunks),
    }