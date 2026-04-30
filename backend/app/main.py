from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.exceptions import (
    NeuralSearchError,
    neural_search_exception_handler,
    unhandled_exception_handler,
)
from app.db.qdrant import init_qdrant_collection, close_qdrant_clients
from app.db.postgres import init_db, close_db
from app.db.redis_cache import close_redis
from app.api.routes.ingest import router as ingest_router
from app.api.routes.query import router as query_router

setup_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", env=settings.app_env, log_level=settings.log_level)
    await init_qdrant_collection()
    await init_db()
    yield
    await close_qdrant_clients()
    await close_db()
    await close_redis()
    logger.info("shutdown")


app = FastAPI(
    title="Neural Search Engine",
    description="Industry-grade RAG system with hybrid retrieval, reranking, and streaming",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(NeuralSearchError, neural_search_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Routers
app.include_router(ingest_router)
app.include_router(query_router)


@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "ok",
        "env": settings.app_env,
        "version": "1.0.0",
    }


@app.get("/", tags=["system"])
async def root():
    return {"message": "Neural Search Engine API", "docs": "/docs"}