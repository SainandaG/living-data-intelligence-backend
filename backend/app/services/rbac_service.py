"""
RBAC Service  Role-Based Access Control

Provides role hierarchy comparison and FastAPI-compatible dependency
factories for protecting endpoints with minimum-role checks.

Two enforcement modes:
  1. require_role("analyst")    Hierarchical: checks user's role level
  2. require_feature("ml_analyze")  Granular: checks the permissions JSONB
     from the 'roles' database table

Usage in a router:
    from app.services.rbac_service import require_role, require_feature

    @router.get("/secure", dependencies=[Depends(require_role("analyst"))])
    async def secure_endpoint(): ...

    @router.post("/ml", dependencies=[Depends(require_feature("ml_analyze", min_role="analyst"))])
    async def ml_endpoint(): ...
"""
import logging
import os
import ssl
import time
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, status

from app.services.auth import get_current_user

logger = logging.getLogger(__name__)

#  Role hierarchy (higher number = more privilege) 
ROLE_HIERARCHY: dict[str, int] = {
    "viewer":      1,
    "editor":      2,
    "analyst":     3,
    "admin":       4,
    "super_admin": 5,
}

# Dev/test role maps to max privilege so dev-token holders aren't blocked
_EFFECTIVE_LEVEL = {**ROLE_HIERARCHY, "developer": 5}

import json
from app.services.redis_client import get_redis

#  Permissions cache (avoids hitting DB on every request) 
_PERM_CACHE: Dict[str, tuple] = {}  # role_name  (timestamp, permissions_dict)
_PERM_CACHE_TTL = 60  # seconds


async def _fetch_role_permissions(role_name: str) -> Dict[str, Any]:
    """Fetch granular permissions JSONB for a role from the database.

    Returns an empty dict if the role is not found or the database is unreachable.
    Results are cached in Redis for _PERM_CACHE_TTL seconds.
    """
    redis = await get_redis()
    cache_key = f"perm:{role_name}"

    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning("Redis cache get failed: %s", e)
    else:
        # Check in-memory cache fallback
        cached_mem = _PERM_CACHE.get(role_name)
        if cached_mem and (time.time() - cached_mem[0]) < _PERM_CACHE_TTL:
            return cached_mem[1]

    permissions: Dict[str, Any] = {}
    try:
        import asyncpg
        db_host = os.getenv("DB_HOST")
        if not db_host:
            return permissions

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
            row = await conn.fetchrow(
                "SELECT permissions FROM roles WHERE name = $1", role_name
            )
            if row and row["permissions"]:
                raw = row["permissions"]
                permissions = json.loads(raw) if isinstance(raw, str) else raw
        finally:
            await conn.close()
    except Exception as exc:
        logger.debug("RBAC: could not fetch permissions for role '%s': %s", role_name, exc)

    if redis:
        try:
            await redis.setex(cache_key, _PERM_CACHE_TTL, json.dumps(permissions))
        except Exception as e:
            logger.warning("Redis cache set failed: %s", e)
    else:
        _PERM_CACHE[role_name] = (time.time(), permissions)

    return permissions


async def get_user_role(user: dict) -> str:
    """Extract the role string, checking Redis for live overrides."""
    jwt_role = user.get("role", "viewer")
    email = user.get("sub")
    if not email:
        return jwt_role
        
    try:
        from app.services.redis_client import get_redis
        redis = await get_redis()
        if redis:
            cached_role = await redis.get(f"user_role:{email}")
            if cached_role:
                return cached_role.decode("utf-8") if isinstance(cached_role, bytes) else cached_role
    except Exception as e:
        logger.warning(f"Redis role lookup failed for {email}: {e}")
        
    return jwt_role


def require_role(min_role: str):
    """Factory that returns a FastAPI Depends-compatible async callable.

    The returned dependency resolves the current user via Bearer token,
    reads the ``role`` claim from the JWT, and raises **403 Forbidden**
    if the user's role level is below *min_role*.

    Respects ``DISABLE_AUTH=true`` (except in production).
    """
    is_prod = os.getenv("APP_ENV", "development") == "production"
    disable_auth = os.getenv("DISABLE_AUTH", "false").lower() == "true"
    
    # If auth is disabled, return a mock super_admin user
    if disable_auth and not is_prod:
        async def _bypass() -> dict:
            return {"sub": "disabled-auth-user", "role": "super_admin", "tenant_id": "default"}
        return _bypass

    min_level = ROLE_HIERARCHY.get(min_role, 0)

    async def _check(user: dict = Depends(get_current_user)) -> dict:
        user_role = await get_user_role(user)
        user_level = _EFFECTIVE_LEVEL.get(user_role, 1)

        if user_level < min_level:
            logger.warning(
                "RBAC denied: user=%s role=%s required=%s",
                user.get("sub", "?"),
                user_role,
                min_role,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: requires '{min_role}' role or above",
            )
        return user

    return _check


def require_feature(feature_id: str, min_role: str = "viewer"):
    """Factory for granular feature-level permission checks.

    Enforces TWO layers:
      1. The user's hierarchical role must meet *min_role*
      2. If the user's role has a permissions JSON entry for *feature_id*
         set to 'none', access is denied even if the hierarchy check passes.

    This bridges the Role Factory UI  backend enforcement gap.
    """
    is_prod = os.getenv("APP_ENV", "development") == "production"
    disable_auth = os.getenv("DISABLE_AUTH", "false").lower() == "true"

    if disable_auth and not is_prod:
        async def _bypass() -> dict:
            return {"sub": "disabled-auth-user", "role": "super_admin", "tenant_id": "default"}
        return _bypass

    min_level = ROLE_HIERARCHY.get(min_role, 0)

    async def _check(user: dict = Depends(get_current_user)) -> dict:
        user_role = await get_user_role(user)
        user_level = _EFFECTIVE_LEVEL.get(user_role, 1)

        permissions = await _fetch_role_permissions(user_role)
        has_granular_grant = False
        
        if permissions:
            for category, features in permissions.items():
                if isinstance(features, dict) and feature_id in features:
                    val = features[feature_id]
                    if val == "none":
                        logger.warning(
                            "RBAC feature denied: user=%s role=%s feature=%s (set to 'none')",
                            user.get("sub", "?"),
                            user_role,
                            feature_id,
                        )
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Feature '{feature_id}' is explicitly disabled for your role",
                        )
                    elif val in ("read", "execute"):
                        has_granular_grant = True

        # Super-admin and admin always bypass hierarchical fallback
        if user_level >= ROLE_HIERARCHY["admin"]:
            return user

        # Fallback to hierarchical check if no explicit grant
        if not has_granular_grant and user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: requires '{min_role}' role or above",
            )

        return user

    return _check


async def invalidate_permissions_cache(role_name: Optional[str] = None):
    """Clear cached permissions. Call after role updates from the admin API."""
    redis = await get_redis()
    
    if role_name:
        _PERM_CACHE.pop(role_name, None)
        if redis:
            try:
                await redis.delete(f"perm:{role_name}")
            except Exception as e:
                logger.warning("Redis delete failed: %s", e)
    else:
        _PERM_CACHE.clear()
        if redis:
            try:
                cursor = '0'
                while cursor != 0:
                    cursor, keys = await redis.scan(cursor=cursor, match="perm:*", count=100)
                    if keys:
                        await redis.delete(*keys)
            except Exception as e:
                logger.warning("Redis scan/delete failed: %s", e)

