import os
import logging
from redis import asyncio as aioredis  # type: ignore
from redis.exceptions import ConnectionError  # type: ignore

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Global pool
_redis_pool = None

async def get_redis() -> aioredis.Redis:
    """
    Get an initialized Redis connection from the pool.
    Returns None if Redis is unreachable (graceful fallback).
    """
    global _redis_pool
    if _redis_pool is None:
        try:
            _redis_pool = aioredis.from_url(
                REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=10
            )
            # Test connection
            await _redis_pool.ping()
        except ConnectionError as e:
            logger.warning(f"Redis is unreachable at {REDIS_URL}: {e}. Falling back to in-memory.")
            _redis_pool = None
            return None
        except Exception as e:
            logger.warning(f"Failed to initialize Redis: {e}. Falling back to in-memory.")
            _redis_pool = None
            return None
            
    return _redis_pool
