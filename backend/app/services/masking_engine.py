import logging
import json
import hashlib
import os
import ssl
from typing import Any, Dict, Optional, List
from app.services.redis_client import get_redis
from app.services.rbac_service import ROLE_HIERARCHY

logger = logging.getLogger(__name__)

CACHE_TTL = 60  # seconds

async def load_policies(connection_id: str, tenant_id: str = "default") -> Dict[str, Any]:
    """
    Fetch all column_policies for a connection.
    Returns a dict keyed as 'table_name.column_name' -> {min_role, mask_strategy}
    Cached in Redis for 60s.
    """
    redis = await get_redis()
    cache_key = f"masking_policies:{connection_id}"
    
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Redis cache get failed for masking policies: {e}")

    policies = {}
    try:
        import asyncpg
        db_host = os.getenv("DB_HOST")
        if not db_host:
            return {}

        ssl_ctx = None
        if "neon.tech" in db_host:
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = True
            ssl_ctx.verify_mode = ssl.CERT_REQUIRED

        conn = await asyncpg.connect(
            host=db_host,
            port=int(os.getenv("DB_PORT", "5432")),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "wezu_backend"),
            ssl=ssl_ctx,
            timeout=5,
        )
        try:
            rows = await conn.fetch(
                "SELECT table_name, column_name, min_role, mask_strategy FROM column_policies WHERE connection_id = $1 AND tenant_id = $2",
                connection_id, tenant_id
            )
            for row in rows:
                key = f"{row['table_name']}.{row['column_name']}"
                policies[key] = {
                    "min_role": row['min_role'],
                    "mask_strategy": row['mask_strategy']
                }
        finally:
            await conn.close()
    except Exception as e:
        logger.error(f"Failed to load masking policies from DB: {e}")

    if redis:
        try:
            await redis.setex(cache_key, CACHE_TTL, json.dumps(policies))
        except Exception as e:
            logger.warning(f"Redis cache set failed for masking policies: {e}")

    return policies

def apply_mask(value: Any, strategy: str) -> Any:
    """Apply a specific masking strategy to a value."""
    if value is None:
        return None
    
    strategy = strategy.lower()
    if strategy == "redact":
        return "[REDACTED]"
    elif strategy == "hash":
        return hashlib.sha256(str(value).encode()).hexdigest()
    elif strategy == "partial":
        val_str = str(value)
        if len(val_str) > 2:
            return val_str[:2] + "****"
        return "****"
    elif strategy == "null":
        return None
    elif strategy == "none":
        return value
    return value

def mask_row(row: Dict[str, Any], table_name: str, policies: Dict[str, Any], user_role: str) -> Dict[str, Any]:
    """
    Apply masking to a single row based on policies and user role level.
    """
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    masked_row = dict(row)
    
    for col_name, value in row.items():
        policy_key = f"{table_name}.{col_name}"
        if policy_key in policies:
            policy = policies[policy_key]
            min_role = policy["min_role"]
            min_level = ROLE_HIERARCHY.get(min_role, 0)
            
            if user_level < min_level:
                masked_row[col_name] = apply_mask(value, policy["mask_strategy"])
                
    return masked_row

async def invalidate_masking_cache(connection_id: str):
    """Invalidate the masking policies cache for a connection."""
    redis = await get_redis()
    if redis:
        try:
            await redis.delete(f"masking_policies:{connection_id}")
        except Exception as e:
            logger.warning(f"Redis cache invalidate failed for masking policies: {e}")
