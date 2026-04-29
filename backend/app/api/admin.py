import os
import logging
import asyncpg
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.services.rbac_service import require_role

import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# DB Connection Helper (consistent with auth.py logic)
async def get_db_conn():
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", 5432))
    db_user = os.getenv("DB_USER")
    db_pass = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME", "wezu_backend")
    
    if not db_user:
        logger.error("DB_USER is not configured")
        raise HTTPException(status_code=500, detail="Database configuration missing")
    
    try:
        return await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_pass,
            database=db_name,
            ssl='require' if 'neon.tech' in db_host else None
        )
    except Exception as e:
        logger.error(f"Failed to connect to primary DB: {e}")
        raise HTTPException(status_code=503, detail="Primary database unavailable")

@router.get("/users")
async def list_users(_user: dict = Depends(require_role("admin"))):
    """List all platform users."""
    conn = await get_db_conn()
    try:
        rows = await conn.fetch("SELECT id, email, role, is_active, created_at FROM users")
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.get("/roles")
async def list_roles(_user: dict = Depends(require_role("admin"))):
    """List all dynamic roles and their permissions."""
    conn = await get_db_conn()
    try:
        # Ensure standard roles exist
        standard_roles = ["admin", "viewer", "editor", "analyst", "super_admin"]
        for sr in standard_roles:
            # Match the complex schema columns: level, is_system_role, is_active, category, tenant_id
            await conn.execute("""
                INSERT INTO roles (name, permissions, description, level, is_system_role, is_active, category, tenant_id) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                ON CONFLICT (name) DO NOTHING
            """, sr, '{}', f"Standard {sr} role", 0, True, True, 'System', 'default')

        rows = await conn.fetch("SELECT name, permissions, description, is_system_role FROM roles")
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Error in list_roles: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch roles from database")
    finally:
        await conn.close()

@router.post("/roles")
async def upsert_role(role_data: Dict[str, Any], _user: dict = Depends(require_role("admin"))):
    """Create or update a dynamic role."""
    name = role_data.get("name")
    permissions = role_data.get("permissions", {})
    description = role_data.get("description", "")
    
    if not name:
        raise HTTPException(status_code=400, detail="Role name is required")
    
    conn = await get_db_conn()
    try:
        # Match the complex schema columns for custom roles
        await conn.execute("""
            INSERT INTO roles (name, permissions, description, level, is_system_role, is_active, category, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (name) DO UPDATE SET
                permissions = EXCLUDED.permissions,
                description = EXCLUDED.description
        """, name, json.dumps(permissions), description, 0, False, True, 'Custom', 'default')
        return {"success": True, "message": f"Role '{name}' saved successfully"}
    except Exception as e:
        logger.error(f"Error in upsert_role: {e}")
        raise HTTPException(status_code=500, detail="Failed to save role to database")
    finally:
        await conn.close()

@router.get("/features")
async def get_features(_user: dict = Depends(require_role("admin"))):
    """Return the registry of controllable features (Feature Matrix)."""
    return {
        "categories": [
            {
                "id": "AUTHENTICATION",
                "name": "Authentication",
                "features": [
                    {"id": "login", "name": "User Login", "description": "Access to login and session management"},
                    {"id": "refresh", "name": "Token Refresh", "description": "Ability to refresh expired sessions"},
                    {"id": "dev_token", "name": "Dev Tokens", "description": "Generate development bypass tokens"}
                ]
            },
            {
                "id": "DATABASE",
                "name": "Database",
                "features": [
                    {"id": "connect", "name": "Connect Database", "description": "Establish new database connections"},
                    {"id": "manage", "name": "Manage Connections", "description": "View and delete existing connections"},
                    {"id": "seed", "name": "Seed Data", "description": "Populate demo data for testing"}
                ]
            },
            {
                "id": "INTELLIGENCE",
                "name": "Intelligence",
                "features": [
                    {"id": "analyze", "name": "Neural Analysis", "description": "Run ML-driven graph analysis"},
                    {"id": "classify", "name": "AI Classification", "description": "Automatically classify table entities"},
                    {"id": "explain", "name": "Explainability", "description": "Generate natural language insights"}
                ]
            },
            {
                "id": "EVOLUTION",
                "name": "Evolution",
                "features": [
                    {"id": "play", "name": "Playback", "description": "View historical database evolution"},
                    {"id": "snapshot", "name": "Snapshots", "description": "Create and manage system state snapshots"}
                ]
            },
            {
                "id": "SECURITY",
                "name": "Security",
                "features": [
                    {"id": "masking", "name": "Column Masking", "description": "Configure field-level redaction policies"},
                    {"id": "audit", "name": "Audit Logs", "description": "View system-wide administrative activity"},
                    {"id": "rbac", "name": "RBAC Management", "description": "Access to the User Management Panel and Role Factory"}
                ]
            }
        ]
    }

@router.patch("/users/{email}/role")
async def update_user_role(email: str, role_data: Dict[str, Any], _user: dict = Depends(require_role("admin"))):
    """Update a user's role."""
    role = role_data.get("role")
    if not role:
        raise HTTPException(status_code=400, detail="Role name is required")
    
    conn = await get_db_conn()
    try:
        await conn.execute("UPDATE users SET role = $1 WHERE email = $2", role, email)
        return {"success": True, "message": f"User {email} updated to {role}"}
    finally:
        await conn.close()
