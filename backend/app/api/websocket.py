from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.connection_manager import connection_manager
from ..services.realtime_monitor import RealtimeMonitor
import asyncio
import json
import uuid
import time
import random

router = APIRouter(prefix="/ws", tags=["websocket"])
monitor = RealtimeMonitor()

@router.websocket("/{connection_id}")
async def websocket_events(websocket: WebSocket, connection_id: str):
    """
    Enhanced WebSocket endpoint for real-time events.
    Each client connection is mapped to their database connection_id.
    """
    # Create a unique client ID since multiple users can view the same db connection
    client_id = f"{connection_id}_{uuid.uuid4()}"
    
    # Register and accept connection, subscribing to the db connection_id topic
    await connection_manager.connect(websocket, client_id, ["broadcast", "metrics", connection_id])
    
    try:
        while True:
            # Listen for client messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            elif data == "pong":
                # Heartbeat handled by manager internally, update last_ping
                if client_id in connection_manager.active_connections:
                    connection_manager.active_connections[client_id].last_ping = time.time()
            else:
                try:
                    payload = json.loads(data)
                    if payload.get("type") == "presence_update":
                        # Attach backend timestamp and broadcast to everyone on this DB connection
                        payload["server_time"] = time.time()
                        # Broadcast to the topic (connection_id), but clients will ignore their own user_id
                        await connection_manager.broadcast(payload, topic=connection_id)
                except json.JSONDecodeError:
                    pass
                    
    except WebSocketDisconnect:
        connection_manager.disconnect(client_id)
    except Exception as e:
        print(f"WebSocket Error for {client_id}: {e}")
        connection_manager.disconnect(client_id)

async def stream_metrics():
    """
    Broadcast periodic metrics and graph evolution to all active connections.
    """
    from app.services.graph_generator import graph_generator
    from app.services.living_graph_engine import living_graph_engine
    
    print("📡 Starting global metrics & evolution broadcast...")
    while True:
        try:
            # Find unique database connection IDs that have active websockets
            active_db_conns = set()
            for client_id in connection_manager.active_connections.keys():
                # Extract the DB connection ID from client_id (format: connection_id_uuid)
                db_conn_id = client_id.split('_')[0]
                active_db_conns.add(db_conn_id)
                
            for conn_id in active_db_conns:
                try:
                    # 0. Safety Check: Is the database actually connected?
                    # If not, skip this session (the user likely needs to re-auth after a server restart)
                    from app.services.db_connector import db_connector
                    if conn_id not in db_connector.connections:
                        continue

                    # 1. Get real metrics
                    data = await monitor.get_realtime_data(conn_id)
                    
                    # 2. Get Graph Evolution (Size/Health of nodes)
                    # We fetch current graph to know who to evolve
                    graph_data = await graph_generator.generate_graph(conn_id)
                    evolved_nodes = []
                    
                    for node in graph_data.get("nodes", []):
                        # Use actual transaction rate for volume-based evolution
                        tx_rate = data['data'].get('transaction_rate', 0)
                        
                        # Reality-Driven: Use 0 for errors/latency unless real telemetry is detected
                        # This removes the "random dummy" jitter.
                        activity = {
                            "transaction_volume": tx_rate * 10,
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
                        
                        # Broadcast isolated differential update to Latent Space
                        from app.api.latent_stream import emit_node_diff
                        asyncio.create_task(emit_node_diff(
                            evolved_node['id'],
                            {
                                'healthScore': evolved_node.get('health_score', evolved_node.get('vitality', 100)),
                                'vitality': evolved_node.get('vitality', 100),
                                'isAnomalous': evolved_node.get('is_anomalous', False),
                                'row_count': evolved_node.get('row_count', 0),
                                'dependencyDepth': evolved_node.get('dependency_depth', 0)
                            }
                        ))
                    
                    # 3. Get per-table row counts for node pulse detection
                    table_counts = {}
                    try:
                        live_tables = ['batteries', 'telemetics_data', 'batteryhealthlog', 'gps_tracking_log', 'stations']
                        for tbl in live_tables:
                            res = await db_connector.query(conn_id, f"SELECT COUNT(*) as c FROM {tbl}")
                            if res:
                                table_counts[tbl] = int(res[0].get('c') or 0)
                    except Exception as e:
                        pass  # Non-critical

                    # 4. Send combined update via broadcast to the connection topic
                    if data:
                        payload = {
                            "type": "metrics_update",
                            "data": data.get('data'),
                            "health": data.get('health'),
                            "anomalies": data.get('anomalies', []),
                            "ai_stats": data.get('ai_stats'),
                            "evolved_nodes": evolved_nodes,
                            "table_counts": table_counts,
                            "timestamp": time.time()
                        }
                        await connection_manager.broadcast(payload, topic=conn_id)
                        
                except Exception as e:
                    print(f"Error streaming for DB conn {conn_id}: {e}")
        except Exception as e:
            print(f"Global streaming error: {e}")
            
        await asyncio.sleep(2.0)


# Start background task
async def start_streaming_task():
    asyncio.create_task(stream_metrics())


