from fastapi import APIRouter, WebSocket, Depends, Query
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
            # Use wait_for so we can send keep-alive pings while also reading
            # client messages (e.g. set_period sent by LatentSpaceLogic_Core.js).
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                try:
                    import json
                    msg = json.loads(raw)
                    # Currently the latent-stream WS only needs to acknowledge
                    # set_period — no server-side state change is required because
                    # the period filtering happens in the main metrics WebSocket.
                    # We log it for observability and ignore it gracefully.
                    if msg.get("type") == "set_period":
                        logger.debug("[LATENT] Received set_period=%s (acknowledged)", msg.get("period"))
                    else:
                        logger.debug("[LATENT] Received message type=%s", msg.get("type", "unknown"))
                except Exception:
                    pass  # Non-JSON frame — ignore
            except asyncio.TimeoutError:
                # No message in 30s — send keep-alive ping
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
async def latent_stream(websocket: WebSocket, token: str = Query(None)):
    import os
    if token:
        from app.services.auth import verify_token
        _token_payload = verify_token(token)
        if not _token_payload and os.getenv("APP_ENV", "development") == "production":
            await websocket.close(code=1008)
            return
    elif os.getenv("APP_ENV", "development") == "production":
        await websocket.close(code=1008)
        return
    await latent_websocket_endpoint(websocket)

from pydantic import BaseModel
class TestDiffPayload(BaseModel):
    changed_fields: dict

@router.post("/api/test-emit/{node_id}")
async def test_emit_route(node_id: str, payload: TestDiffPayload, _user: dict = Depends(require_role("admin"))):
    await emit_node_diff(node_id, payload.changed_fields)
    return {"status": "success", "msg": f"Emitted {payload.changed_fields} to {node_id}"}