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
    # Register and accept connection
    await connection_manager.connect(websocket, connection_id, ["broadcast", "metrics"])
    
    try:
        while True:
            # Listen for client messages (like pongs or standard messages)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            elif data == "pong":
                # Heartbeat handled by manager internally, but we can update last_ping here
                if connection_id in connection_manager.active_connections:
                    connection_manager.active_connections[connection_id].last_ping = time.time()
                    
    except WebSocketDisconnect:
        connection_manager.disconnect(connection_id)
    except Exception as e:
        print(f"WebSocket Error for {connection_id}: {e}")
        connection_manager.disconnect(connection_id)

async def stream_metrics():
    """
    Broadcast periodic metrics and graph evolution to all active connections.
    """
    from app.services.graph_generator import graph_generator
    from app.services.living_graph_engine import living_graph_engine
    
    print("📡 Starting global metrics & evolution broadcast...")
    while True:
        try:
            for conn_id in list(connection_manager.active_connections.keys()):
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
                        # Simulating activity metrics for evolution
                        # In real use, this would come from a per-node metric store
                        activity = {
                            "transaction_volume": data['data'].get('transaction_rate', 0) * 10,
                            "error_rate": random.random() * 0.02,
                            "avg_latency": 100 + random.random() * 50
                        }
                        evolved_node = living_graph_engine.evolve_node(node, activity)
                        evolved_nodes.append({
                            "id": evolved_node['id'],
                            "size": evolved_node['size'],
                            "status": evolved_node.get('status', 'healthy'),
                            "vitality": evolved_node.get('vitality', 1.0)
                        })
                    
                    # 3. Send combined update
                    if data:
                        payload = {
                            "type": "metrics_update",
                            "data": data.get('data'),
                            "health": data.get('health'),
                            "ai_stats": data.get('ai_stats'),
                            "evolved_nodes": evolved_nodes,
                            "timestamp": time.time()
                        }
                        await connection_manager.send_personal(conn_id, payload)
                        
                except Exception as e:
                    print(f"Error streaming for {conn_id}: {e}")
        except Exception as e:
            print(f"Global streaming error: {e}")
            
        await asyncio.sleep(2.0)


# Start background task
async def start_streaming_task():
    asyncio.create_task(stream_metrics())


