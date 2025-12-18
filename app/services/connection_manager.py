from fastapi import WebSocket
from typing import Dict, Any
import json

class ConnectionManager:
    """Manage WebSocket connections"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, connection_id: str):
        """Accept and store WebSocket connection"""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        print(f"✅ WebSocket connected: {connection_id}")
    
    def disconnect(self, connection_id: str):
        """Remove WebSocket connection"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            print(f"❌ WebSocket disconnected: {connection_id}")
    
    async def send_update(self, connection_id: str, data: Dict[str, Any]):
        """Send update to specific connection"""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            try:
                await websocket.send_json(data)
            except Exception as e:
                print(f"Error sending update to {connection_id}: {str(e)}")
                self.disconnect(connection_id)
    
    async def broadcast(self, data: Dict[str, Any]):
        """Broadcast to all connections"""
        for connection_id in list(self.active_connections.keys()):
            await self.send_update(connection_id, data)
