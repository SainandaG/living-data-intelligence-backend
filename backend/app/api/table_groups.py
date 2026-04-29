"""
Table Groups API
Allows users to save and retrieve clusters of tables for multi-inspection.
"""
import json
import logging
import time
import uuid
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.rbac_service import require_role

logger = logging.getLogger(__name__)

router = APIRouter()

# Use data/table_groups as base storage
BASE_DIR = Path("data/table_groups")
BASE_DIR.mkdir(parents=True, exist_ok=True)

class TableGroup(BaseModel):
    id: str
    title: str
    connection_id: str
    table_names: List[str]
    created_at: float

class CreateTableGroupRequest(BaseModel):
    title: str
    table_names: List[str]

def _get_storage_path(connection_id: str) -> Path:
    # Sanitize connection_id for filename usage
    safe_conn = connection_id.replace(":", "_").replace("/", "_")
    return BASE_DIR / f"{safe_conn}.json"

def _load_groups(connection_id: str) -> List[Dict]:
    path = _get_storage_path(connection_id)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception as e:
            logger.error(f"Failed to load table groups from {path}: {e}")
            return []
    return []

def _save_groups(connection_id: str, groups: List[Dict]):
    path = _get_storage_path(connection_id)
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(groups, fh, indent=2)
    except Exception as e:
        logger.error(f"Failed to save table groups to {path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to persist table group")

@router.get("/table-groups/{connection_id}")
async def get_table_groups(connection_id: str, _user: dict = Depends(require_role("viewer"))):
    """List all saved table groups for a specific connection"""
    return _load_groups(connection_id)

@router.post("/table-groups/{connection_id}")
async def save_table_group(connection_id: str, req: CreateTableGroupRequest, _user: dict = Depends(require_role("editor"))):
    """Save a new table group"""
    if not req.table_names:
        raise HTTPException(status_code=400, detail="Table list cannot be empty")
        
    groups = _load_groups(connection_id)
    
    new_item = {
        "id": str(uuid.uuid4()),
        "title": req.title,
        "connection_id": connection_id,
        "table_names": req.table_names,
        "created_at": time.time()
    }
    
    # Prevent duplicate titles within same connection to keep UI clean
    filtered = [g for g in groups if g["title"] != req.title]
    filtered.append(new_item)
    
    _save_groups(connection_id, filtered)
    return new_item

@router.delete("/table-groups/{connection_id}/{group_id}")
async def delete_table_group(connection_id: str, group_id: str, _user: dict = Depends(require_role("editor"))):
    """Delete a saved table group"""
    groups = _load_groups(connection_id)
    filtered = [g for g in groups if g["id"] != group_id]
    
    if len(filtered) == len(groups):
        raise HTTPException(status_code=404, detail="Table group not found")
        
    _save_groups(connection_id, filtered)
    return {"status": "deleted"}
