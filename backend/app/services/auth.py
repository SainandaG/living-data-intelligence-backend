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
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    """Hash a plaintext password"""
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against its hashed version"""
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    """Create a new JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    """Create a long-lived refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=REFRESH_TOKEN_EXPIRE)
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
    """FastAPI Dependency to enforce valid HTTP Bearer token"""
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload
