"""
Saved Selections API
Allows users to save and retrieve multi-node selections (PKs + metrics)
per connection and table.
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

logger = logging.getLogger(__name__)

router = APIRouter()

# Use data/selections as base storage
BASE_DIR = Path("data/selections")
BASE_DIR.mkdir(parents=True, exist_ok=True)

class SavedSelection(BaseModel):
    id: str
    title: str
    connection_id: str
    table_name: str
    pks: List[Any]  # List of primary key values
    pk_labels: List[str] # Human readable labels
    metrics: List[str] # List of selected metrics (e.g. ["source > voltage"])
    created_at: float

class CreateSelectionRequest(BaseModel):
    title: str
    pks: List[Any]
    pk_labels: Optional[List[str]] = None
    metrics: List[str]

def _get_storage_path(connection_id: str, table_name: str) -> Path:
    # Sanitize inputs for filename usage
    safe_conn = connection_id.replace(":", "_").replace("/", "_")
    safe_table = table_name.replace(":", "_").replace("/", "_")
    conn_dir = BASE_DIR / safe_conn
    conn_dir.mkdir(parents=True, exist_ok=True)
    return conn_dir / f"{safe_table}.json"

def _load_selections(connection_id: str, table_name: str) -> List[Dict]:
    path = _get_storage_path(connection_id, table_name)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception as e:
            logger.error(f"Failed to load selections from {path}: {e}")
            return []
    return []

def _save_selections(connection_id: str, table_name: str, selections: List[Dict]):
    path = _get_storage_path(connection_id, table_name)
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(selections, fh, indent=2)
    except Exception as e:
        logger.error(f"Failed to save selections to {path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to persist selection")

@router.get("/selections/{connection_id}/{table_name}")
async def get_selections(connection_id: str, table_name: str):
    """List all saved selections for a specific table under a connection"""
    return _load_selections(connection_id, table_name)

@router.post("/selections/{connection_id}/{table_name}")
async def save_selection(connection_id: str, table_name: str, req: CreateSelectionRequest):
    """Save a new multi-node selection"""
    selections = _load_selections(connection_id, table_name)
    
    new_item = {
        "id": str(uuid.uuid4()),
        "title": req.title,
        "connection_id": connection_id,
        "table_name": table_name,
        "pks": req.pks,
        "pk_labels": req.pk_labels or [str(pk) for pk in req.pks],
        "metrics": req.metrics,
        "created_at": time.time()
    }
    
    selections.append(new_item)
    _save_selections(connection_id, table_name, selections)
    return new_item

@router.delete("/selections/{connection_id}/{table_name}/{selection_id}")
async def delete_selection(connection_id: str, table_name: str, selection_id: str):
    """Delete a saved selection"""
    selections = _load_selections(connection_id, table_name)
    filtered = [s for s in selections if s["id"] != selection_id]
    
    if len(filtered) == len(selections):
        raise HTTPException(status_code=404, detail="Selection not found")
        
    _save_selections(connection_id, table_name, filtered)
    return {"status": "deleted"}
