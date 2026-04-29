"""
RBAC Service — Role-Based Access Control

Provides role hierarchy comparison and FastAPI-compatible dependency
factories for protecting endpoints with minimum-role checks.

Usage in a router:
    from app.services.rbac_service import require_role

    @router.get("/secure", dependencies=[Depends(require_role("analyst"))])
    async def secure_endpoint(): ...
"""
import logging
from fastapi import Depends, HTTPException, status

from app.services.auth import get_current_user

logger = logging.getLogger(__name__)

# ── Role hierarchy (higher number = more privilege) ───────────────────────────
ROLE_HIERARCHY: dict[str, int] = {
    "viewer":      1,
    "editor":      2,
    "analyst":     3,
    "admin":       4,
    "super_admin": 5,
}

# Dev/test role maps to max privilege so dev-token holders aren't blocked
_EFFECTIVE_LEVEL = {**ROLE_HIERARCHY, "developer": 5}


def get_user_role(user: dict) -> str:
    """Extract the role string from a decoded JWT payload.

    Returns 'viewer' as a safe default when the claim is missing.
    """
    return user.get("role", "viewer")


def require_role(min_role: str):
    """Factory that returns a FastAPI Depends-compatible async callable.

    The returned dependency resolves the current user via Bearer token,
    reads the ``role`` claim from the JWT, and raises **403 Forbidden**
    if the user's role level is below *min_role*.

    Respects ``DISABLE_AUTH=true`` (except in production).
    """
    import os
    is_prod = os.getenv("APP_ENV", "development") == "production"
    disable_auth = os.getenv("DISABLE_AUTH", "false").lower() == "true"
    
    # If auth is disabled, return a mock super_admin user
    if disable_auth and not is_prod:
        async def _bypass() -> dict:
            return {"sub": "disabled-auth-user", "role": "super_admin", "tenant_id": "default"}
        return _bypass

    min_level = ROLE_HIERARCHY.get(min_role, 0)

    async def _check(user: dict = Depends(get_current_user)) -> dict:
        user_role = get_user_role(user)
        user_level = _EFFECTIVE_LEVEL.get(user_role, 0)

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
