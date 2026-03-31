"""
Tenant Context — lightweight tenant isolation for the current request.

In development (single-tenant) mode every request is assigned to the
default tenant so all existing code paths continue to work without change.
In production, the tenant is resolved from the JWT claim "tenant_id".

Usage (FastAPI dependency):
    from app.services.platform.tenant_context import get_tenant_id

    @router.get("/items")
    async def items(tenant_id: str = Depends(get_tenant_id)):
        ...
"""
from __future__ import annotations

import os
import logging
from dataclasses import dataclass

from fastapi import Request

logger = logging.getLogger(__name__)

DEFAULT_TENANT = "default"


@dataclass
class TenantContext:
    tenant_id: str
    plan: str = "starter"       # starter / pro / enterprise
    is_default: bool = False    # True when running single-tenant / dev mode


def get_tenant_id(request: Request) -> str:
    """
    FastAPI dependency — returns the tenant_id for the current request.

    Resolution order:
      1. `request.state.tenant_id`  (set by auth middleware in production)
      2. JWT claim `tenant_id`      (decoded earlier by get_current_user)
      3. DEFAULT_TENANT             (dev / single-tenant mode)
    """
    # Auth middleware may already have resolved this
    if hasattr(request.state, "tenant_id") and request.state.tenant_id:
        return request.state.tenant_id

    # JWT user object stored on request.state.user by get_current_user
    user = getattr(request.state, "user", None)
    if user and isinstance(user, dict):
        tid = user.get("tenant_id")
        if tid:
            return tid

    # Dev / single-tenant fallback
    env_tenant = os.getenv("DEFAULT_TENANT_ID", DEFAULT_TENANT)
    return env_tenant


def get_tenant_context(request: Request) -> TenantContext:
    """Returns a full TenantContext (includes plan tier)."""
    tid = get_tenant_id(request)
    user = getattr(request.state, "user", {}) or {}
    plan = user.get("plan", "starter")
    return TenantContext(
        tenant_id=tid,
        plan=plan,
        is_default=(tid == DEFAULT_TENANT),
    )
