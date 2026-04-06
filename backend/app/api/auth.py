import json
import os
import time
import logging
import threading
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from typing import Dict

from app.services.auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    verify_password
)

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)
except ImportError:
    limiter = None

# Refresh tokens expire after 7 days by default; use same window for cleanup
_REVOKE_TTL_SECONDS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")) * 86400

logger = logging.getLogger(__name__)


# =============================================================================
# Token Revocation Store — Thread-safe, TTL-pruning, container-safe
# =============================================================================
# In-memory store with periodic file persistence. Designed so that:
#  1. Revoked tokens are always checked from fast in-memory dict (zero I/O per request)
#  2. File persistence is best-effort — if the container restarts, tokens naturally expire
#  3. Thread-safe via a lock (important for concurrent request handling)
#  4. Stale entries are pruned on every write to keep memory bounded
#
# For multi-instance / HA deployments: swap this for a Redis SET with TTL.
# =============================================================================

_REVOKE_STORE_PATH = os.path.join("data", "auth", "revoked_tokens.json")
_revoked_tokens: Dict[str, float] = {}
_revoke_lock = threading.Lock()


def _load_revoked() -> None:
    """Load persisted revocation list on startup, pruning any already-expired entries."""
    global _revoked_tokens
    try:
        if os.path.exists(_REVOKE_STORE_PATH):
            with open(_REVOKE_STORE_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
            now = time.time()
            _revoked_tokens = {t: exp for t, exp in raw.items() if exp > now}
            logger.info("auth: loaded %d active revocations from disk", len(_revoked_tokens))
    except Exception as exc:
        logger.warning("auth: could not load revocation store (starting fresh): %s", exc)
        _revoked_tokens = {}


def _persist_revoked() -> None:
    """Best-effort persist to disk. Non-critical — tokens have natural expiry."""
    try:
        os.makedirs(os.path.dirname(_REVOKE_STORE_PATH), exist_ok=True)
        # Atomic-ish write: write to temp then rename
        tmp_path = _REVOKE_STORE_PATH + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(_revoked_tokens, f)
        os.replace(tmp_path, _REVOKE_STORE_PATH)
    except Exception as exc:
        logger.warning("auth: failed to persist revocation store: %s", exc)


def _prune_expired() -> int:
    """Remove expired entries. Returns count of pruned entries. Caller must hold _revoke_lock."""
    now = time.time()
    stale = [t for t, exp in _revoked_tokens.items() if exp <= now]
    for t in stale:
        del _revoked_tokens[t]
    return len(stale)


def _is_revoked(token: str) -> bool:
    """Thread-safe check if a token is revoked."""
    with _revoke_lock:
        expiry = _revoked_tokens.get(token)
        if expiry is None:
            return False
        if time.time() > expiry:
            # Token has naturally expired — evict
            _revoked_tokens.pop(token, None)
            return False
        return True


def _revoke_token(token: str) -> None:
    """Thread-safe revocation with pruning and best-effort persistence."""
    with _revoke_lock:
        _revoked_tokens[token] = time.time() + _REVOKE_TTL_SECONDS
        _prune_expired()
        _persist_revoked()


# Hydrate on import
_load_revoked()

router = APIRouter(tags=["authentication"])


def _get_valid_users() -> Dict[str, str]:
    """
    Build the user store from environment variables.
    Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH in your environment to provision
    an initial admin account. Never store plaintext passwords here.

    Example (generate hash with bcrypt):
        python -c "from passlib.hash import bcrypt; print(bcrypt.hash('yourpassword'))"
    """
    users: Dict[str, str] = {}
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password_hash = os.getenv("ADMIN_PASSWORD_HASH")
    if admin_email and admin_password_hash:
        users[admin_email] = admin_password_hash
    return users


class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/login")
async def login(request: Request, login_data: LoginRequest):
    """Authenticate and return JWT tokens"""
    valid_users = _get_valid_users()
    hashed_pwd = valid_users.get(login_data.email)

    if not hashed_pwd or not verify_password(login_data.password, hashed_pwd):
        # Do not log the email — it is PII and leaks valid account enumeration
        logger.warning("Failed login attempt from %s", request.client.host if request.client else "unknown")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": login_data.email})
    refresh_token = create_refresh_token(data={"sub": login_data.email})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    """Exchange a valid refresh token for a new access token"""
    token = body.refresh_token

    if _is_revoked(token):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    new_access_token = create_access_token(data={"sub": email})
    return {"access_token": new_access_token}


@router.post("/logout")
async def logout(body: RefreshRequest):
    """Invalidate a refresh token"""
    _revoke_token(body.refresh_token)
    return {"status": "success", "message": "Successfully logged out"}


@router.post("/dev-token")
async def dev_token():
    """
    Issue a development-only JWT without credentials.
    Blocked in production. Use this for local dev and testing when auth is enforced.
    """
    if os.getenv("APP_ENV", "development") == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev tokens are not available in production"
        )

    access_token = create_access_token(data={"sub": "dev@localhost", "role": "developer"})
    refresh_token = create_refresh_token(data={"sub": "dev@localhost", "role": "developer"})

    logger.info("Dev token issued for dev@localhost")
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "note": "Development-only token. Not available in production."
    }
