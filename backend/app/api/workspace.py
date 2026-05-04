"""
Workspace API  /api/workspace

Persistent investigation workspaces: canvas state, evidence chains,
shareable investigation links.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.services.rbac_service import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workspace", tags=["workspace"])

WORKSPACE_DIR = Path("data/workspaces")
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

#  In-memory store (file-backed) 

_workspaces: Dict[str, Dict] = {}


def _load_workspace(wid: str) -> Dict | None:
    if wid in _workspaces:
        return _workspaces[wid]
    path = WORKSPACE_DIR / f"{wid}.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        _workspaces[wid] = data
        return data
    return None


def _save_workspace(ws: Dict) -> None:
    wid = ws["id"]
    _workspaces[wid] = ws
    path = WORKSPACE_DIR / f"{wid}.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(ws, fh)


#  Models 

class CreateWorkspaceRequest(BaseModel):
    title:         str
    connection_id: Optional[str] = None
    session_id:    Optional[str] = None  # link from agent session
    tenant_id:     str = "default"
    user_id:       Optional[str] = None
    canvas_state:  Dict = {}
    evidence_chain: List[Dict] = []


class UpdateWorkspaceRequest(BaseModel):
    title:         Optional[str] = None
    canvas_state:  Optional[Dict] = None
    evidence_chain: Optional[List[Dict]] = None
    status:        Optional[str] = None  # open | concluded | archived


class AddEvidenceRequest(BaseModel):
    type:     str        # chart | finding | annotation | ml_result | anomaly
    title:    str
    content:  Dict
    pinned:   bool = False


#  Endpoints 

@router.get("")
async def list_workspaces(
    tenant_id: str = "default",
    limit: int = 20,
    _user: dict = Depends(require_role("viewer")),
) -> Dict[str, Any]:
    all_ws = [w for w in _workspaces.values() if w.get("tenant_id") == tenant_id]

    # Also scan disk for any not loaded
    for path in WORKSPACE_DIR.glob("*.json"):
        wid = path.stem
        if wid not in _workspaces:
            try:
                with open(path, "r", encoding="utf-8") as fh:
                    w = json.load(fh)
                if w.get("tenant_id") == tenant_id:
                    _workspaces[wid] = w
                    all_ws.append(w)
            except Exception:
                pass

    all_ws.sort(key=lambda w: w.get("updated_at", 0), reverse=True)
    return {"workspaces": all_ws[:limit], "total": len(all_ws)}


@router.post("")
async def create_workspace(req: CreateWorkspaceRequest, _user: dict = Depends(require_role("viewer"))) -> Dict[str, Any]:
    wid = str(uuid.uuid4())
    now = time.time()
    ws = {
        "id":             wid,
        "title":          req.title,
        "connection_id":  req.connection_id,
        "session_id":     req.session_id,
        "tenant_id":      req.tenant_id,
        "user_id":        req.user_id,
        "canvas_state":   req.canvas_state,
        "evidence_chain": req.evidence_chain,
        "status":         "open",
        "created_at":     now,
        "updated_at":     now,
    }
    _save_workspace(ws)
    logger.info("workspace_created id=%s title='%s'", wid, req.title)
    return ws


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str, _user: dict = Depends(require_role("viewer"))) -> Dict[str, Any]:
    ws = _load_workspace(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    return ws


@router.patch("/{workspace_id}")
async def update_workspace(workspace_id: str, req: UpdateWorkspaceRequest, _user: dict = Depends(require_role("viewer"))) -> Dict[str, Any]:
    ws = _load_workspace(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    if req.title is not None:
        ws["title"] = req.title
    if req.canvas_state is not None:
        ws["canvas_state"] = req.canvas_state
    if req.evidence_chain is not None:
        ws["evidence_chain"] = req.evidence_chain
    if req.status is not None:
        ws["status"] = req.status
    ws["updated_at"] = time.time()

    _save_workspace(ws)
    return ws


@router.post("/{workspace_id}/evidence")
async def add_evidence(workspace_id: str, req: AddEvidenceRequest) -> Dict[str, Any]:
    ws = _load_workspace(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    item = {
        "id":        str(uuid.uuid4()),
        "type":      req.type,
        "title":     req.title,
        "content":   req.content,
        "pinned":    req.pinned,
        "added_at":  time.time(),
    }
    ws.setdefault("evidence_chain", []).append(item)
    ws["updated_at"] = time.time()
    _save_workspace(ws)
    return item


@router.delete("/{workspace_id}/evidence/{evidence_id}")
async def remove_evidence(workspace_id: str, evidence_id: str) -> Dict[str, str]:
    ws = _load_workspace(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    ws["evidence_chain"] = [e for e in ws.get("evidence_chain", []) if e["id"] != evidence_id]
    ws["updated_at"] = time.time()
    _save_workspace(ws)
    return {"status": "removed"}


@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str, _user: dict = Depends(require_role("admin"))) -> Dict[str, str]:
    ws = _load_workspace(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    ws["status"] = "archived"
    ws["updated_at"] = time.time()
    _save_workspace(ws)
    if workspace_id in _workspaces:
        del _workspaces[workspace_id]
    return {"status": "archived"}


