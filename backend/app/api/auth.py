import logging
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from typing import Dict

from app.services.auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    hash_password,
    verify_password
)

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)
except ImportError:
    # Fallback if slowapi import fails before server restarts
    limiter = None
    
# Module level set for basic refresh token invalidation
# In a real app, this should be in Redis/Database
invalidated_refresh_tokens = set()

logger = logging.getLogger(__name__)

router = APIRouter(tags=["authentication"])

# Temporary mock user data store (for demo purposes)
# In a real system, query the database.
HARDCODED_USERS = {
    # email: hashed_password
    # The default mock password here will be 'admin'
    "admin@livingdata.network": "$2b$12$Kk0gQ2Fq0X//0H4I0vQ0N.E9hP379sE2r5H9W4.wzS/QJ2/9i9yqW" # hash of 'admin'
}

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

@router.post("/login")
@limiter.limit("10/minute") if limiter else lambda x: x
def login(request: Request, login_data: LoginRequest):
    """Authenticate and return JWT tokens"""
    
    email = login_data.email
    password = login_data.password
    
    hashed_pwd = HARDCODED_USERS.get(email)
    
    if not hashed_pwd or not verify_password(password, hashed_pwd):
        # We also support a catch-all for this demo if no database users exist yet:
        # If user exactly types "admin" "admin", we'll let them in for the preview.
        if email != "admin" or password != "admin":
            logger.warning(f"Failed login attempt for {email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
    # Valid credentials
    access_token = create_access_token(data={"sub": email})
    refresh_token = create_refresh_token(data={"sub": email})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

# Dynamic registration removed as we now use decorator


@router.post("/refresh")
def refresh_token(body: RefreshRequest):
    """Exchange a valid refresh token for a new access token"""
    token = body.refresh_token
    
    if token in invalidated_refresh_tokens:
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
def logout(body: RefreshRequest):
    """Invalidate a refresh token"""
    invalidated_refresh_tokens.add(body.refresh_token)
    return {"status": "success", "message": "Successfully logged out"}
