import json
import os
import time
import logging
from pathlib import Path
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

# TTL-based revocation store: {token: expiry_epoch_seconds}
# File-backed so revocations survive process restarts.
# For multi-instance deployments replace with a shared Redis SET.
_REVOKE_STORE = Path("data/auth/revoked_tokens.json")
_revoked_tokens: Dict[str, float] = {}

logger = logging.getLogger(__name__)


def _load_revoked() -> None:
    """Load persisted revocation list, pruning any already-expired entries."""
    global _revoked_tokens
    try:
        if _REVOKE_STORE.exists():
            raw = json.loads(_REVOKE_STORE.read_text(encoding="utf-8"))
            now = time.time()
            _revoked_tokens = {t: exp for t, exp in raw.items() if exp > now}
    except Exception as exc:
        logger.error("auth: failed to load revocation store: %s", exc)


def _save_revoked() -> None:
    """Atomically persist the current revocation store."""
    try:
        _REVOKE_STORE.parent.mkdir(parents=True, exist_ok=True)
        _REVOKE_STORE.write_text(json.dumps(_revoked_tokens), encoding="utf-8")
    except Exception as exc:
        logger.error("auth: failed to save revocation store: %s", exc)


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


def _is_revoked(token: str) -> bool:
    """Return True if the token is in the revocation store and still within its TTL."""
    expiry = _revoked_tokens.get(token)
    if expiry is None:
        return False
    if time.time() > expiry:
        # Token has naturally expired — safe to evict
        _revoked_tokens.pop(token, None)
        return False
    return True


def _revoke_token(token: str) -> None:
    """Add a token to the revocation store, prune stale entries, and persist."""
    _revoked_tokens[token] = time.time() + _REVOKE_TTL_SECONDS
    # Prune entries whose TTL has passed to keep the file bounded
    now = time.time()
    stale = [t for t, exp in _revoked_tokens.items() if exp <= now]
    for t in stale:
        _revoked_tokens.pop(t, None)
    _save_revoked()


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
