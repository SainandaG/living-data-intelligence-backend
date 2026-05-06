import json
import os
import ssl
import time
import logging
import threading
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Optional

import asyncpg

from app.services.auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    verify_password,
    hash_password
)
from app.services.platform.audit_logger import audit_logger, AuditEvent, AuditEventType

from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

# Refresh tokens expire after 7 days by default; use same window for cleanup
_REVOKE_TTL_SECONDS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")) * 86400

logger = logging.getLogger(__name__)


from app.services.redis_client import get_redis

_revoked_tokens: Dict[str, float] = {}

async def _is_revoked(token: str) -> bool:
    """Check if a token is revoked, using Redis with in-memory fallback."""
    payload = verify_token(token)
    if not payload:
        return True # Invalid tokens are effectively revoked
        
    jti = payload.get("jti")
    if not jti:
        return False
        
    redis = await get_redis()
    if redis:
        try:
            return bool(await redis.exists(f"revoked:{jti}"))
        except Exception as e:
            logger.warning(f"Redis check failed: {e}")
            
    # Fallback to in-memory check if Redis is unavailable
    expiry = _revoked_tokens.get(jti)
    if expiry is None:
        return False
    if time.time() > expiry:
        _revoked_tokens.pop(jti, None)
        return False
    return True

async def _revoke_token(token: str) -> None:
    """Revoke a token, using Redis with in-memory fallback."""
    payload = verify_token(token)
    if not payload:
        return
        
    jti = payload.get("jti")
    if not jti:
        return
        
    exp = payload.get("exp")
    if not exp:
        ttl = _REVOKE_TTL_SECONDS
    else:
        ttl = max(1, int(exp - time.time()))
        
    redis = await get_redis()
    if redis:
        try:
            await redis.setex(f"revoked:{jti}", ttl, "")
            return
        except Exception as e:
            logger.warning(f"Redis set failed: {e}")
            
    # Fallback to in-memory if Redis is unavailable
    _revoked_tokens[jti] = time.time() + ttl

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

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role: str = "viewer"
    tenant_id: Optional[str] = "default"


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, login_data: LoginRequest):
    """Authenticate and return JWT tokens.
    
    Respects ``DISABLE_AUTH=true`` (except in production).
    """
    import os
    is_prod = os.getenv("APP_ENV", "development") == "production"
    disable_auth = os.getenv("DISABLE_AUTH", "false").lower() == "true"

    if disable_auth and not is_prod:
        email = login_data.email
        token_data = {"sub": email, "role": "super_admin", "tenant_id": "default"}
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "email": email,
                "role": "super_admin",
                "permissions": {}
            }
        }

    email = login_data.email
    role: str = "viewer"
    tenant_id: str = "default"
    authenticated = False

    #  Primary path: look up user in the platform `users` table 
    try:
        db_host = os.getenv("DB_HOST")
        if db_host:
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
                timeout=10,
            )
            try:
                row = await conn.fetchrow(
                    "SELECT hashed_password as password_hash, role, tenant_id, is_active, two_factor_enabled AS mfa_enabled "
                    "FROM users WHERE email = $1",
                    email,
                )
                if row:
                    if not row["is_active"]:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Account is deactivated",
                        )
                    if verify_password(login_data.password, row["password_hash"]):
                        role = row["role"]
                        tenant_id = row["tenant_id"]
                        authenticated = True
            finally:
                await conn.close()
    except HTTPException:
        raise
    except Exception as db_err:
        logger.warning("Platform DB lookup unavailable, falling back to env: %s", db_err)

    #  Fallback: env-var bootstrap admin 
    if not authenticated:
        valid_users = _get_valid_users()
        hashed_pwd = valid_users.get(email)
        if hashed_pwd and verify_password(login_data.password, hashed_pwd):
            role = "admin"
            tenant_id = "default"
            authenticated = True

    if not authenticated:
        # Track failed attempts in Redis for brute force protection
        redis = await get_redis()
        if redis:
            fail_key = f"login_fail:{email}"
            try:
                fail_count = await redis.incr(fail_key)
                if fail_count == 1:
                    await redis.expire(fail_key, 300) # 5 minute window
                
                if fail_count >= 5:
                    # LOCK ACCOUNT in DB
                    try:
                        db_host = os.getenv("DB_HOST")
                        if db_host:
                            conn = await asyncpg.connect(
                                host=db_host,
                                port=int(os.getenv("DB_PORT", "5432")),
                                user=os.getenv("DB_USER", "postgres"),
                                password=os.getenv("DB_PASSWORD", ""),
                                database=os.getenv("DB_NAME", "wezu_backend"),
                                ssl=ssl_ctx if 'ssl_ctx' in locals() else None
                            )
                            await conn.execute("UPDATE users SET is_active = false WHERE email = $1", email)
                            await conn.close()
                            logger.critical(f"Account locked due to brute force: {email}")
                    except Exception as lock_err:
                        logger.error(f"Failed to lock account {email}: {lock_err}")
                    
                    raise HTTPException(
                        status_code=status.HTTP_423_LOCKED,
                        detail="Account locked due to multiple failed attempts. Contact administrator.",
                    )
            except Exception as redis_err:
                if isinstance(redis_err, HTTPException): raise
                logger.warning(f"Redis failed tracking login: {redis_err}")

        # Do not log the email  it is PII and leaks valid account enumeration
        logger.warning("Failed login attempt from %s", request.client.host if request.client else "unknown")
        
        # Log failed attempt
        await audit_logger.log(AuditEvent(
            event_type=AuditEventType.LOGIN_FAILED,
            user_id=email,
            metadata={"ip": request.client.host if request.client else "unknown"}
        ))
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    #  Final Response 
    # Check if MFA is enabled for this user (only from DB, env-users don't have MFA)
    mfa_enabled = False
    if authenticated and 'row' in locals() and row:
        mfa_enabled = row.get("mfa_enabled", False)
        # Clear failed login count on success
        redis = await get_redis()
        if redis:
            await redis.delete(f"login_fail:{email}")

    if mfa_enabled:
        # Issue a temporary token for MFA challenge
        mfa_token = create_access_token(data={"sub": email, "mfa_pending": True})
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "message": "MFA challenge required"
        }

    token_data = {"sub": email, "role": role, "tenant_id": tenant_id}
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)

    # Fetch permissions for the role if possible
    permissions = {}
    try:
        if db_host:
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
            )
            try:
                row = await conn.fetchrow("SELECT permissions FROM roles WHERE name = $1", role)
                if row and row["permissions"]:
                    raw = row["permissions"]
                    permissions = json.loads(raw) if isinstance(raw, str) else raw
            finally:
                await conn.close()
    except Exception as e:
        logger.warning("Could not fetch permissions for role %s: %s", role, e)

    # Log success
    await audit_logger.log(AuditEvent(
        event_type=AuditEventType.LOGIN_SUCCESS,
        user_id=email,
        role=role,
        metadata={"tenant_id": tenant_id}
    ))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "email": email,
            "role": role,
            "permissions": permissions
        }
    }


@router.post("/register")
async def register(request: Request, body: RegisterRequest):
    """Self-registration for new users."""
    email = body.email.lower().strip()
    
    # Validate Role (prevent self-elevation)
    allowed_roles = ["viewer", "editor", "analyst"]
    if body.role.lower() not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration only allowed for roles: {', '.join(allowed_roles)}"
        )

    db_host = os.getenv("DB_HOST")
    if not db_host:
        raise HTTPException(status_code=500, detail="Database host not configured")

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
        timeout=10,
    )
    
    try:
        # Check if email exists
        exists = await conn.fetchval("SELECT 1 FROM users WHERE email = $1", email)
        if exists:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        
        # Create user
        hashed_pwd = hash_password(body.password)
        await conn.execute(
            """
            INSERT INTO users (
                full_name, email, hashed_password, role, tenant_id, 
                is_active, is_superuser, kyc_status, consent_captured, 
                two_factor_enabled, biometric_login_enabled, status, 
                two_factor_pending, is_email_verified, is_deleted,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, TRUE, FALSE, 'pending', FALSE, FALSE, FALSE, 'active', FALSE, FALSE, FALSE, NOW(), NOW())
            """,
            body.full_name, email, hashed_pwd, body.role.lower(), body.tenant_id or "default"
        )
        
        # Auto-login: issue tokens
        token_data = {"sub": email, "role": body.role.lower(), "tenant_id": body.tenant_id or "default"}
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)
        
        # Audit Log
        await audit_logger.log(AuditEvent(
            event_type=AuditEventType.USER_REGISTERED,
            user_id=email,
            role=body.role.lower(),
            metadata={"full_name": body.full_name, "tenant_id": body.tenant_id}
        ))
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "email": email,
                "role": body.role.lower(),
                "permissions": {}
            }
        }
    finally:
        await conn.close()

@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh_token(request: Request, body: RefreshRequest):
    """Exchange a valid refresh token for a new access token.

    Carries role and tenant_id forward from the original token so
    downstream middleware continues to see the correct claims.
    """
    token = body.refresh_token

    if await _is_revoked(token):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # --- DB re-validation: ensure user is still active with a valid role ---
    try:
        import os, ssl, asyncpg
        db_host = os.getenv("DB_HOST")
        ssl_ctx = None
        if db_host and "neon.tech" in db_host:
            ssl_ctx = ssl.create_default_context()
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
                "SELECT is_active, role, tenant_id FROM users WHERE email = $1", email
            )
        finally:
            await conn.close()

        if not row:
            raise HTTPException(status_code=401, detail="User not found")
        if not row["is_active"]:
            raise HTTPException(status_code=401, detail="Account is deactivated")

        # Use live values from DB, not stale JWT claims
        role      = row["role"]
        tenant_id = row["tenant_id"] or payload.get("tenant_id", "default")
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Refresh: DB check failed, falling back to token claims: %s", exc)
        role      = payload.get("role", "viewer")
        tenant_id = payload.get("tenant_id", "default")
    # --- End DB re-validation ---

    new_access_token = create_access_token(
        data={"sub": email, "role": role, "tenant_id": tenant_id}
    )
    return {"access_token": new_access_token}


@router.post("/logout")
async def logout(body: RefreshRequest):
    """Invalidate a refresh token"""
    token = body.refresh_token
    payload = verify_token(token)
    if payload:
        await audit_logger.log(AuditEvent(
            event_type=AuditEventType.LOGOUT,
            user_id=payload.get("sub"),
            role=payload.get("role")
        ))
    await _revoke_token(token)
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