from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # API Keys
    groq_api_key: str
    gemini_api_key: str

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_collection: str = "neural_search"

    # PostgreSQL
    database_url: str

    # Redis
    redis_url: str = "redis://localhost:6379"
    redis_ttl: int = 3600

    # Embedding
    embedding_model: str = "models/gemini-embedding-001"
    embedding_dim: int = 3072

    # Chunking
    chunk_size: int = 512
    chunk_overlap: int = 64

    # Retrieval
    retrieval_score_threshold: float = 0.65
    retrieval_top_k: int = 20
    top_k_single_doc: int = 5
    top_k_per_doc_multi: int = 3
    rrf_k: int = 60
    reranker_top_n: int = 5

    # LLM
    groq_model: str = "llama-3.3-70b-versatile"
    llm_temperature: float = 0.0
    llm_max_tokens: int = 1024

    # App
    app_env: str = "development"
    log_level: str = "INFO"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()