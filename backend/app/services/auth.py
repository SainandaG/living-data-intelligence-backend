"""
Authentication Service

Handles JWT token creation, verification, password hashing, and token refresh logic.
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

logger = logging.getLogger(__name__)

def _get_jwt_secret() -> str:
    """Lazily fetch JWT secret to allow lifespan to set fallback."""
    return os.getenv("JWT_SECRET_KEY", "")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = 60  # minutes
REFRESH_TOKEN_EXPIRE = 10080  # 7 days in minutes

# Password Hashing Setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 Scheme (extracts token from HTTP Authorization header)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def hash_password(password: str) -> str:
    """Hash a plaintext password"""
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against its hashed version"""
    return pwd_context.verify(plain, hashed)

import uuid

def create_access_token(data: dict) -> str:
    """Create a new JWT access token.

    Args:
        data: Token payload dict.  Must include:
            - **sub** (str): User email / principal identifier.
            - **role** (str): RBAC role (viewer, editor, analyst, admin, super_admin).
            - **tenant_id** (str): Tenant scope for multi-tenancy isolation.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE)
    if "jti" not in to_encode:
        to_encode["jti"] = str(uuid.uuid4())
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    """Create a long-lived refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=REFRESH_TOKEN_EXPIRE)
    if "jti" not in to_encode:
        to_encode["jti"] = str(uuid.uuid4())
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    """Verify a token and return the payload if valid, None otherwise"""
    secret = _get_jwt_secret()
    if not secret:
        logger.error("JWT_SECRET_KEY is not configured; cannot verify tokens")
        return None
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"JWT Verification Failed: {str(e)}")
        return None

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """FastAPI Dependency to enforce valid HTTP Bearer token.
    
    Respects ``DISABLE_AUTH=true`` (except in production).
    """
    import os
    is_prod = os.getenv("APP_ENV", "development") == "production"
    disable_auth = os.getenv("DISABLE_AUTH", "false").lower() == "true"

    if disable_auth and not is_prod:
        return {"sub": "disabled-auth-user", "role": "super_admin", "tenant_id": "default"}

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    from app.api.auth import _is_revoked
    if await _is_revoked(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return payload
