import hashlib
import json
from typing import Any

import redis.asyncio as aioredis
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_redis_client: aioredis.Redis | None = None


def get_redis_client() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
    return _redis_client


def make_cache_key(normalized_query: str, rewritten_query: str) -> str:
    """
    Deterministic cache key from both query forms.
    SHA-256 keeps keys short and safe for Redis.
    """
    combined = f"{normalized_query}||{rewritten_query}"
    return "query:" + hashlib.sha256(combined.encode()).hexdigest()


async def get_cached_response(key: str) -> dict | None:
    try:
        client = get_redis_client()
        value = await client.get(key)
        if value:
            logger.info("cache_hit", key=key[:20])
            return json.loads(value)
        return None
    except Exception as e:
        # Cache failure must never break the query pipeline
        logger.warning("cache_get_failed", error=str(e))
        return None


async def set_cached_response(key: str, data: dict, ttl: int = None) -> None:
    try:
        client = get_redis_client()
        await client.setex(
            key,
            ttl or settings.redis_ttl,
            json.dumps(data),
        )
        logger.info("cache_set", key=key[:20], ttl=ttl or settings.redis_ttl)
    except Exception as e:
        logger.warning("cache_set_failed", error=str(e))


async def close_redis() -> None:
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None