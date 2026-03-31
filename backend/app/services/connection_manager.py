"""
WebSocket Connection Manager

Manages active WebSocket connections, topic subscriptions, and heartbeat loops.
"""
import asyncio
import time
import logging
from typing import Dict, Set, Any, List, Optional
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

class WebSocketConnection:
    """Wrapper for WebSocket with health and metadata tracking"""
    def __init__(self, websocket: WebSocket, connection_id: str):
        self.websocket = websocket
        self.connection_id = connection_id
        self.connected_at = time.time()
        self.last_ping = time.time()
        self.ping_count = 0
        self.message_count = 0
        self.is_alive = True
    
    async def send(self, message: dict):
        """Send JSON message with robust error handling"""
        try:
            await self.websocket.send_json(message)
            self.message_count += 1
        except Exception as e:
            logger.warning(f"WebSocket send failed for {self.connection_id}: {e}")
            self.is_alive = False
            raise
    
    async def ping(self):
        """Send ping to verify client is still connected"""
        try:
            # Using send_text for a simple ping frame if not using full JSON
            await self.websocket.send_text("ping")
            self.last_ping = time.time()
            self.ping_count += 1
        except Exception as e:
            logger.warning(f"WebSocket ping failed for {self.connection_id}: {e}")
            self.is_alive = False
            raise

class WebSocketManager:
    """
    Production-grade WebSocket manager with memory leak prevention,
    heartbeat monitoring, and topic-based broadcasting.
    """
    def __init__(
        self, 
        heartbeat_interval: float = 30.0,
        connection_timeout: float = 90.0,
        max_connections: int = 1000
    ):
        self.active_connections: Dict[str, WebSocketConnection] = {}
        self.topics: Dict[str, Set[str]] = {}
        self.heartbeat_interval = heartbeat_interval
        self.connection_timeout = connection_timeout
        self.max_connections = max_connections
        self._background_tasks = set()

    async def start(self):
        """Initialize background maintenance tasks"""
        cleanup_task = asyncio.create_task(self._cleanup_loop())
        heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        self._background_tasks.add(cleanup_task)
        self._background_tasks.add(heartbeat_task)
        cleanup_task.add_done_callback(self._background_tasks.discard)
        heartbeat_task.add_done_callback(self._background_tasks.discard)
        logger.info("✅ WebSocket Manager started with maintenance loops.")

    async def connect(self, websocket: WebSocket, connection_id: str, initial_topics: List[str] = ["broadcast"]):
        """Register and accept a new connection"""
        if len(self.active_connections) >= self.max_connections:
            await websocket.close(code=1008, reason="Server at max capacity")
            return None
        
        await websocket.accept()
        conn = WebSocketConnection(websocket, connection_id)
        self.active_connections[connection_id] = conn
        
        for topic in initial_topics:
            self.join_topic(connection_id, topic)
            
        logger.info(f"✅ WebSocket connected: {connection_id} (Total: {len(self.active_connections)})")
        return connection_id

    def disconnect(self, connection_id: str):
        """Gracefully remove a connection from all registries"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            
        # Remove from topics
        for topic_connections in self.topics.values():
            if connection_id in topic_connections:
                topic_connections.remove(connection_id)
        
        logger.info(f"❌ WebSocket disconnected: {connection_id} (Total: {len(self.active_connections)})")

    def join_topic(self, connection_id: str, topic: str):
        if topic not in self.topics:
            self.topics[topic] = set()
        self.topics[topic].add(connection_id)

    async def send_personal(self, connection_id: str, message: dict):
        """Send message to a specific connection by ID"""
        conn = self.active_connections.get(connection_id)
        if conn and conn.is_alive:
            try:
                await conn.send(message)
            except Exception as e:
                logger.warning(f"WS send failed for {connection_id}: {e}")
                self.disconnect(connection_id)

    async def broadcast(self, message: dict, topic: str = "broadcast"):
        """Broadacst to all subscribers of a topic"""
        if topic not in self.topics:
            return

        target_ids = list(self.topics[topic])
        dead_ids = []

        for conn_id in target_ids:
            conn = self.active_connections.get(conn_id)
            if conn and conn.is_alive:
                try:
                    await conn.send(message)
                except Exception as e:
                    logger.debug(f"WS broadcast send failed for {conn_id}: {e}")
                    dead_ids.append(conn_id)
            else:
                dead_ids.append(conn_id)
        
        for dead_id in dead_ids:
            self.disconnect(dead_id)

    async def _heartbeat_loop(self):
        """Periodic pinging of all connected clients"""
        while True:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                for conn_id, conn in list(self.active_connections.items()):
                    try:
                        await conn.ping()
                    except Exception as e:
                        logger.debug(f"WS heartbeat ping failed for {conn_id}: {e}")
                        self.disconnect(conn_id)
            except Exception as e:
                logger.error(f"WebSocket Heartbeat Error: {e}")

    async def _cleanup_loop(self):
        """Removes connections that haven't responded to pings or marked dead"""
        while True:
            try:
                await asyncio.sleep(60) # check every minute
                now = time.time()
                stale_ids = []
                
                for conn_id, conn in self.active_connections.items():
                    if not conn.is_alive or (now - conn.last_ping > self.connection_timeout):
                        stale_ids.append(conn_id)
                
                for sid in stale_ids:
                    logger.warning(f"Cleaning up stale connection: {sid}")
                    self.disconnect(sid)
            except Exception as e:
                logger.error(f"WebSocket Cleanup Error: {e}")

# Global instance
connection_manager = WebSocketManager()
ConnectionManager = WebSocketManager # For compatibility
