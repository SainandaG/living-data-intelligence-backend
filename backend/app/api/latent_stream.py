from fastapi import APIRouter, WebSocket, Depends
import asyncio
import logging

from app.services.rbac_service import require_role

logger = logging.getLogger(__name__)
router = APIRouter()

active_latent_connections: list[WebSocket] = []

async def latent_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_latent_connections.append(websocket)
    try:
        while True:
            await asyncio.sleep(30)  # Keep-alive ping
            await websocket.send_json({"ping": True})
    except Exception as e:
        logger.debug("Latent WebSocket closed: %s", e)
    finally:
        if websocket in active_latent_connections:
            active_latent_connections.remove(websocket)

async def emit_node_diff(node_id: str, changed_fields: dict):
    """
    Call this from anywhere in the backend when a node's health, anomaly status, or row count changes.
    """
    logger.debug("[LATENT EMIT] %s -> %s", node_id, changed_fields)
    payload = {"node_id": node_id, **changed_fields}
    dead = []
    for ws in active_latent_connections:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in active_latent_connections:
            active_latent_connections.remove(ws)

@router.websocket("/ws/latent-stream")
async def latent_stream(websocket: WebSocket):
    await latent_websocket_endpoint(websocket)

from pydantic import BaseModel
class TestDiffPayload(BaseModel):
    changed_fields: dict

@router.post("/api/test-emit/{node_id}")
async def test_emit_route(node_id: str, payload: TestDiffPayload, _user: dict = Depends(require_role("admin"))):
    await emit_node_diff(node_id, payload.changed_fields)
    return {"status": "success", "msg": f"Emitted {payload.changed_fields} to {node_id}"}
