import os
import ssl
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.services.auth import get_current_user, create_access_token, verify_token
from app.services.rbac_service import require_role
from app.services.mfa_service import mfa_service
from app.services.redis_client import get_redis
from app.api.auth import limiter
from fastapi import Request

router = APIRouter(tags=["mfa"])

class MFAEnableRequest(BaseModel):
    code: str
    secret: str

class MFAVerifyRequest(BaseModel):
    mfa_token: str
    code: str

async def get_db_conn():
    db_host = os.getenv("DB_HOST")
    if not db_host:
        raise HTTPException(status_code=500, detail="Database host not configured")
    
    ssl_ctx = None
    if "neon.tech" in db_host:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = True
        ssl_ctx.verify_mode = ssl.CERT_REQUIRED

    return await asyncpg.connect(
        host=db_host,
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "wezu_backend"),
        ssl=ssl_ctx,
        timeout=10,
    )

@router.post("/setup", dependencies=[Depends(require_role("admin"))])
async def mfa_setup(user: dict = Depends(get_current_user)):
    """Generate MFA secret and QR code for the current admin user."""
    secret = mfa_service.generate_mfa_secret()
    provisioning_uri = mfa_service.get_provisioning_uri(user["sub"], secret)
    qr_code = mfa_service.get_qr_code_base64(provisioning_uri)
    
    return {
        "secret": secret,
        "qr_code": f"data:image/png;base64,{qr_code}"
    }

@router.post("/enable", dependencies=[Depends(require_role("admin"))])
async def mfa_enable(body: MFAEnableRequest, user: dict = Depends(get_current_user)):
    """Verify the first MFA code and enable MFA for the user."""
    if not mfa_service.verify_otp(body.secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")
    
    conn = await get_db_conn()
    try:
        await conn.execute(
            "UPDATE users SET mfa_secret = $1, mfa_enabled = TRUE WHERE email = $2",
            body.secret, user["sub"]
        )
    finally:
        await conn.close()
        
    return {"success": True, "message": "MFA enabled successfully"}

@router.post("/verify")
@limiter.limit("5/minute")
async def mfa_verify(request: Request, body: MFAVerifyRequest):
    """Verify MFA code during login challenge."""
    payload = verify_token(body.mfa_token)
    if not payload or not payload.get("mfa_pending"):
        raise HTTPException(status_code=401, detail="Invalid or expired MFA token")
    
    email = payload["sub"]
    
    # Track failed MFA attempts in Redis
    redis = await get_redis()
    if redis:
        fail_key = f"mfa_fail:{email}"
        fail_count = int(await redis.get(fail_key) or 0)
        if fail_count >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many MFA failed attempts. Try again in 5 minutes."
            )
    
    conn = await get_db_conn()
    try:
        row = await conn.fetchrow(
            "SELECT mfa_secret, role, tenant_id FROM users WHERE email = $1 AND mfa_enabled = TRUE",
            email
        )
        if not row:
            raise HTTPException(status_code=404, detail="MFA not enabled for this user")
            
        if not mfa_service.verify_otp(row["mfa_secret"], body.code):
            if redis:
                await redis.incr(fail_key)
                await redis.expire(fail_key, 300) # 5 minute window
            raise HTTPException(status_code=401, detail="Invalid MFA code")
            
        # Success - Clear failed attempts
        if redis:
            await redis.delete(fail_key)
            
        # Success - Issue full tokens
        token_data = {"sub": email, "role": row["role"], "tenant_id": row["tenant_id"]}
        from app.services.auth import create_refresh_token
        
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "email": email,
                "role": row["role"]
            }
        }
    finally:
        await conn.close()
