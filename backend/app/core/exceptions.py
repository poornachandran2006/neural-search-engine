from fastapi import Request
from fastapi.responses import JSONResponse
import structlog

logger = structlog.get_logger(__name__)


class NeuralSearchError(Exception):
    """Base exception for all application errors."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class DocumentNotFoundError(NeuralSearchError):
    def __init__(self, doc_id: str):
        super().__init__(f"Document {doc_id} not found", status_code=404)


class IngestError(NeuralSearchError):
    def __init__(self, message: str):
        super().__init__(f"Ingestion failed: {message}", status_code=422)


class RetrievalError(NeuralSearchError):
    def __init__(self, message: str):
        super().__init__(f"Retrieval failed: {message}", status_code=500)


class EmbeddingError(NeuralSearchError):
    def __init__(self, message: str):
        super().__init__(f"Embedding failed: {message}", status_code=500)


class LLMError(NeuralSearchError):
    def __init__(self, message: str):
        super().__init__(f"LLM call failed: {message}", status_code=500)


async def neural_search_exception_handler(
    request: Request, exc: NeuralSearchError
) -> JSONResponse:
    logger.error(
        "application_error",
        path=str(request.url),
        error=exc.message,
        status_code=exc.status_code,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "path": str(request.url)},
    )


async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    logger.error(
        "unhandled_error",
        path=str(request.url),
        error=str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "path": str(request.url)},
    )