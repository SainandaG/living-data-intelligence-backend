"""
WebSocket Protocol for Living Data Intelligence Platform

SERVER  CLIENT (JSON):
  {"type": "ping", "timestamp": int} - Heartbeat
  {"type": "connected", "connection_id": str, "client_count": int} - Connection ack
  {"type": "metrics_update", "data": MetricsPayload, ...} - Real-time statistics
  {"type": "db_reconnecting", "message": str} - DB wake-up notification
  {"type": "error", "message": str, "code": str} - Protocol or DB errors

CLIENT  SERVER (JSON/Text):
  {"type": "pong"} - Heartbeat response
  "ping" - Legacy health check (deprecated)
  {"type": "presence_update", "user_id": str, "cursor": {x, y}} - Real-time presence
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from ..services.realtime_monitor import RealtimeMonitor
from app.services.auth import verify_token
import asyncio
import json
import uuid
import time
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])
monitor = RealtimeMonitor()

# Module-level registry: Key = connection_id, Value = list of WebSockets
active_connections: dict[str, list[WebSocket]] = {}

# User email → set of WebSockets (for targeted role-change pushes)
# Key = user email (str), Value = list of WebSocket objects
_user_ws_registry: dict[str, list[WebSocket]] = {}


def _register_user_ws(email: str, ws: WebSocket) -> None:
    """Register a WebSocket as belonging to a specific user email."""
    if email not in _user_ws_registry:
        _user_ws_registry[email] = []
    if ws not in _user_ws_registry[email]:
        _user_ws_registry[email].append(ws)


def _unregister_user_ws(email: str, ws: WebSocket) -> None:
    """Remove a WebSocket from the user registry."""
    if email in _user_ws_registry:
        try:
            _user_ws_registry[email].remove(ws)
        except ValueError:
            pass
        if not _user_ws_registry[email]:
            del _user_ws_registry[email]


async def broadcast_role_change(email: str, new_role: str, permissions: dict = None) -> int:
    """Push a role_update event to every open WebSocket for *email*.

    Returns the number of sockets successfully notified.
    Called from admin.py after a role assignment or permission change.
    """
    sockets = list(_user_ws_registry.get(email, []))
    if not sockets:
        logger.info("RBAC broadcast: no open sockets for %s — will rely on next token refresh", email)
        return 0

    payload = {
        "type": "role_update",
        "email": email,
        "role": new_role,
        "permissions": permissions or {},
        "timestamp": time.time(),
    }
    sent = 0
    stale = []
    for ws in sockets:
        ok = await safe_send(ws, payload)
        if ok:
            sent += 1
        else:
            stale.append(ws)
    for ws in stale:
        _unregister_user_ws(email, ws)

    logger.info("RBAC broadcast: sent role_update to %d/%d sockets for %s", sent, len(sockets), email)
    return sent


async def broadcast_permission_change_for_role(role_name: str, permissions: dict) -> int:
    """Push a role_update event to every connected user that has *role_name*.

    Called from admin.py when a role's permission set is modified in Role Factory.
    The frontend will then silently re-fetch a fresh token via /auth/refresh.
    """
    total_sent = 0
    for email, sockets in list(_user_ws_registry.items()):
        # We don't store roles in the registry — send to all and let the frontend
        # check if the role matches before reloading. The payload includes the role name
        # so the frontend can filter.
        payload = {
            "type": "permissions_update",
            "role": role_name,
            "permissions": permissions or {},
            "timestamp": time.time(),
        }
        stale = []
        for ws in list(sockets):
            ok = await safe_send(ws, payload)
            if ok:
                total_sent += 1
            else:
                stale.append(ws)
        for ws in stale:
            _unregister_user_ws(email, ws)

    logger.info("RBAC broadcast: sent permissions_update for role=%s to %d sockets", role_name, total_sent)
    return total_sent

# Graph cache: avoid regenerating the full graph on every 2-second tick.
# Key = connection_id, Value = (generated_at_epoch, graph_dict)
_graph_cache: dict[str, tuple[float, dict]] = {}
_GRAPH_CACHE_TTL: float = float(os.getenv("WS_GRAPH_CACHE_TTL_SECONDS", "30"))

# Live tables monitored per connection  override via WS_LIVE_TABLES env var (comma-separated)
_LIVE_TABLES: list[str] = [
    t.strip() for t in os.getenv("WS_LIVE_TABLES", "").split(",") if t.strip()
]

# Track previous table counts to detect inserts
_prev_table_counts: dict[str, dict[str, int]] = {}

# Track period preference per WebSocket client
_ws_periods: dict[WebSocket, str] = {}

def get_total_client_count():
    return sum(len(sockets) for sockets in active_connections.values())

async def safe_send(ws: WebSocket, payload: dict) -> bool:
    """Send JSON message with timeout; returns False if connection is broken"""
    try:
        await asyncio.wait_for(ws.send_json(payload), timeout=5.0)
        return True
    except Exception as e:
        logger.debug(f"safe_send failed: {e}")
        return False

@router.websocket("/{connection_id}")
async def websocket_endpoint(websocket: WebSocket, connection_id: str, token: str = Query(None)):
    """
    Production-grade WebSocket endpoint with heartbeat, registry tracking,
    and multi-tab support.
    """
    # Authenticate and extract user email for targeted role-change broadcasts
    _ws_user_email: str | None = None
    if token:
        _token_payload = verify_token(token)
        if _token_payload:
            _ws_user_email = _token_payload.get("sub")
        elif os.getenv("APP_ENV", "development") == "production":
            logger.warning("WebSocket auth failed for connection %s  closing with 1008", connection_id)
            await websocket.close(code=1008)
            return
    elif os.getenv("APP_ENV", "development") == "production":
        logger.warning("WebSocket auth failed for connection %s  closing with 1008", connection_id)
        await websocket.close(code=1008)
        return

    await websocket.accept()
    
    # 1. Register connection
    if connection_id not in active_connections:
        active_connections[connection_id] = []
    active_connections[connection_id].append(websocket)

    # Set default period
    _ws_periods[websocket] = 'day'

    # Register user email → ws mapping for RBAC role-change broadcasts
    if _ws_user_email:
        _register_user_ws(_ws_user_email, websocket)
    
    total_clients = get_total_client_count()
    logger.info(f" WS connect: {connection_id} | total clients: {total_clients}")
    
    # 2. Send Greeting
    await safe_send(websocket, {
        "type": "connected",
        "connection_id": connection_id,
        "client_count": len(active_connections[connection_id])
    })
    
    try:
        while True:
            try:
                # 25s ping interval, 10s pong response window
                # Wait for message or timeout after 25s to send ping
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=25.0)
                except asyncio.TimeoutError:
                    # Send Heartbeat Ping
                    ping_payload = {"type": "ping", "timestamp": int(time.time() * 1000)}
                    if await safe_send(websocket, ping_payload):
                        # Wait 10s for Pong
                        try:
                            pong_data = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
                            if pong_data == "ping": # Legacy support
                                continue
                            
                            try:
                                payload = json.loads(pong_data)
                                if payload.get("type") == "pong":
                                    continue
                                else:
                                    data = pong_data
                            except json.JSONDecodeError:
                                data = pong_data # Process as raw text if not JSON
                        except asyncio.TimeoutError:
                            logger.warning(f" Heartbeat timeout: {connection_id}")
                            break
                    else:
                        break
                
                # Process incoming data (if not already handled by pong logic)
                if data == "ping":
                    await websocket.send_text("pong")
                elif data == "pong":
                    continue
                else:
                    try:
                        payload = json.loads(data)
                        if payload.get("type") == "pong":
                            continue
                        elif payload.get("type") == "set_period":
                            period = payload.get("period", "day")
                            _ws_periods[websocket] = period
                            logger.info(f"WS: Set period to {period} for {connection_id}")
                        elif payload.get("type") == "presence_update":
                            payload["server_time"] = time.time()
                            # Relay to other clients on the same DB connection
                            sockets = active_connections.get(connection_id, [])
                            for ws in sockets:
                                if ws != websocket:
                                    asyncio.create_task(safe_send(ws, payload))
                    except json.JSONDecodeError as e:
                        logger.warning("WebSocket received invalid JSON from %s: %s", connection_id, e)
                        
            except WebSocketDisconnect:
                break
    finally:
        # 3. Cleanup logic
        if websocket in _ws_periods:
            del _ws_periods[websocket]
        if _ws_user_email:
            _unregister_user_ws(_ws_user_email, websocket)
        if connection_id in active_connections:
            if websocket in active_connections[connection_id]:
                active_connections[connection_id].remove(websocket)
            if not active_connections[connection_id]:
                del active_connections[connection_id]
                # Evict graph cache  no clients left for this connection
                _graph_cache.pop(connection_id, None)
        
        total_remaining = get_total_client_count()
        logger.info(f" WS disconnect: {connection_id} | total clients: {total_remaining}")
        try:
            await websocket.close()
        except Exception as e:
            logger.debug(f"WS close error (already closed): {e}")

@router.websocket("/logs/{session_id}")
async def websocket_logs_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time generation logs.
    Subscribes to the specific session topic in connection_manager.
    """
    from app.services.connection_manager import connection_manager
    ws_id = f"logs_{session_id}_{uuid.uuid4().hex[:6]}"
    
    try:
        # Join the specific session topic
        topic = f"generation_logs_{session_id}"
        await connection_manager.connect(websocket, ws_id, initial_topics=[topic])
        
        # Keep connection alive and handle incoming (pings)
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info(f" Log WS disconnected: {ws_id}")
    except Exception as e:
        logger.error(f"Error in Log WebSocket {ws_id}: {e}")
    finally:
        connection_manager.disconnect(ws_id)


async def _collect_table_counts(conn_id: str, tables: list[str]) -> dict:
    """Fetch live row counts for specified tables."""
    from app.services.db_connector import db_connector
    table_counts = {}
    for tbl in tables:
        try:
            res = await db_connector.query(
                conn_id,
                'SELECT COUNT(*) as c FROM ' + db_connector.validate_identifier(tbl)
            )
            if res:
                table_counts[tbl] = int(res[0].get('c') or 0)
        except Exception as e:
            logger.debug("Table count failed for %s/%s: %s", conn_id, tbl, e)
    return table_counts


async def _collect_table_activity(conn_id: str, tables: list[str], period: str = 'day') -> dict:
    """Fetch row counts for specified tables within the last day or week."""
    from app.services.db_connector import db_connector
    activity = {}
    
    # Define interval based on period
    interval = "interval '7 days'" if period == 'week' else "interval '1 day'"
        
    for tbl in tables:
        # Try with 'timestamp' column
        try:
            res = await db_connector.query(
                conn_id,
                f"SELECT COUNT(*) as c FROM {db_connector.validate_identifier(tbl)} WHERE timestamp > NOW() - {interval}"
            )
            if res:
                activity[tbl] = int(res[0].get('c') or 0)
                continue
        except Exception:
            pass # Try next column
            
        # Try with 'updated_at' column
        try:
            res = await db_connector.query(
                conn_id,
                f"SELECT COUNT(*) as c FROM {db_connector.validate_identifier(tbl)} WHERE updated_at > NOW() - {interval}"
            )
            if res:
                activity[tbl] = int(res[0].get('c') or 0)
                continue
        except Exception:
            pass
            
        # Fallback: 0 activity if no timestamp column
        activity[tbl] = 0
        
    return activity


async def _broadcast_evolved_nodes(conn_id: str, graph_data: dict, data: dict, deltas: dict, period: str = 'day') -> list:
    """Compute evolved node diffs and emit latent space updates. Returns evolved_nodes list."""
    from app.services.living_graph_engine import living_graph_engine
    evolved_nodes = []
    for node in graph_data.get("nodes", []):
        tbl_id = node['id']
        delta = deltas.get(tbl_id, 0)
        
        tx_rate = data['data'].get('transaction_rate', 0)
        activity = {
            "transaction_volume": (tx_rate * 10) + (delta * 100), # Boost activity if rows were inserted
            "error_rate": 0.0,
            "avg_latency": 0.0,
            "connection_id": conn_id
        }
        evolved_node = living_graph_engine.evolve_node(node, activity)
        evolved_nodes.append({
            "id": evolved_node['id'],
            "size": evolved_node['size'],
            "status": evolved_node.get('status', 'healthy'),
            "vitality": evolved_node.get('vitality', 1.0)
        })
        from app.api.latent_stream import emit_node_diff
        
        diff_payload = {
            'period': period,
            'healthScore': evolved_node.get('health_score', evolved_node.get('vitality', 100)),
            'vitality': evolved_node.get('vitality', 100),
            'isAnomalous': evolved_node.get('is_anomalous', False),
            'row_count': evolved_node.get('row_count', 0),
            'dependencyDepth': evolved_node.get('dependency_depth', 0)
        }
        
        # If the table has activity in this period, update last_interaction!
        if delta > 0:
            from datetime import datetime
            diff_payload['last_interaction'] = datetime.now().isoformat()
            
        asyncio.create_task(emit_node_diff(
            evolved_node['id'],
            diff_payload
        ))
    return evolved_nodes


async def _stream_to_connection(conn_id: str, sockets: list, consecutive_failures: dict) -> None:
    """Stream one metrics cycle to a single database connection's WebSocket clients."""
    from app.services.db_connector import db_connector
    from app.services.graph_generator import graph_generator

    if conn_id not in db_connector.connections:
        return

    pool = db_connector.connections[conn_id]['client']
    if hasattr(pool, 'is_closing') and pool.is_closing():
        logger.warning(f"DB Pool {conn_id} is closing. Skipping metrics stream.")
        return

    try:
        data = await monitor.get_realtime_data(conn_id)
        consecutive_failures[conn_id] = 0
    except Exception as e:
        consecutive_failures[conn_id] = consecutive_failures.get(conn_id, 0) + 1
        logger.debug(f"DB metric collection failed for {conn_id} (attempt {consecutive_failures[conn_id]}): {e}")
        if consecutive_failures[conn_id] >= 3:
            payload = {"type": "db_reconnecting", "message": "Database is waking up...", "timestamp": time.time()}
            stale = [ws for ws in sockets if not await safe_send(ws, payload)]
            for ws in stale:
                if ws in sockets:
                    sockets.remove(ws)
        return

    # Use cached graph to avoid regenerating the full graph on every 2-second tick
    now = time.time()
    cached = _graph_cache.get(conn_id)
    if cached and (now - cached[0]) < _GRAPH_CACHE_TTL:
        graph_data = cached[1]
    else:
        graph_data = await graph_generator.generate_graph(conn_id)
        _graph_cache[conn_id] = (now, graph_data)

    # Get table names from graph_data
    table_names = [node['id'] for node in graph_data.get("nodes", [])]
    
    # Collect current counts for total counts
    current_counts = await _collect_table_counts(conn_id, table_names)
    
    # Collect activity counts for both day and week
    activity_day = await _collect_table_activity(conn_id, table_names, period='day')
    activity_week = await _collect_table_activity(conn_id, table_names, period='week')
    
    logger.info(f"Activity counts (day): {activity_day}")
    logger.info(f"Activity counts (week): {activity_week}")

    # Calculate evolved nodes for both
    evolved_day = await _broadcast_evolved_nodes(conn_id, graph_data, data, activity_day, period='day')
    evolved_week = await _broadcast_evolved_nodes(conn_id, graph_data, data, activity_week, period='week')

    if data:
        # Send appropriate data to each socket based on preference
        for ws in sockets:
            period = _ws_periods.get(ws, 'day')
            evolved_nodes = evolved_week if period == 'week' else evolved_day
            
            payload = {
                "type": "metrics_update",
                "data": data.get('data'),
                "health": data.get('health'),
                "anomalies": data.get('anomalies', []),
                "ai_stats": data.get('ai_stats'),
                "evolved_nodes": evolved_nodes,
                "table_counts": current_counts,
                "timestamp": time.time()
            }
            asyncio.create_task(safe_send(ws, payload))
            
        # Clean up stale sockets (done in gather in original code, but here we do it fire-and-forget)
        # We assume safe_send handles failures or they will be caught on next cycle
        
        if not active_connections.get(conn_id) and conn_id in active_connections:
            del active_connections[conn_id]

async def stream_metrics():
    """Broadcast periodic metrics and graph evolution to all active connections."""
    logger.info("Streaming Service: Starting metrics & evolution broadcast loop...")
    consecutive_failures: dict = {}

    try:
        while True:
            for conn_id in list(active_connections.keys()):
                sockets = active_connections.get(conn_id, [])
                if not sockets:
                    continue
                try:
                    await _stream_to_connection(conn_id, sockets, consecutive_failures)
                except Exception as e:
                    logger.error(f"Error streaming for DB conn {conn_id}: {e}")
            await asyncio.sleep(5.0)
    except asyncio.CancelledError:
        logger.info("Streaming Service: Broadcast loop cancelled.")
        raise
    except Exception as e:
        logger.error(f"Global streaming error: {e}")
        await asyncio.sleep(5.0)

async def start_streaming_task():
    """Starts the streaming task. Note: main.py now tracks this directly."""
    return asyncio.create_task(stream_metrics())