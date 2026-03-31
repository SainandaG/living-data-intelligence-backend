"""
Generation Log Service

Streams step-by-step progress logs during graph generation to subscribed WebSocket clients.
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from app.services.connection_manager import connection_manager

logger = logging.getLogger(__name__)

class GenerationLogService:
    """
    Service for recording and broadcasting the graph generation process.
    Provides real-time visibility into the "Neural Graph Core" engine logic.
    """
    
    def __init__(self):
        # session_id -> List of log entries
        self.log_buffers: Dict[str, List[Dict[str, Any]]] = {}
        # session_id -> current percentage (0-100)
        self.progress: Dict[str, float] = {}

    async def log_step(self, session_id: str, message: str, level: str = "info", progress: Optional[float] = None):
        """
        Record a process step and broadcast it to connected clients.
        """
        if session_id not in self.log_buffers:
            self.log_buffers[session_id] = []
            
        if progress is not None:
            self.progress[session_id] = progress
            
        entry = {
            "timestamp": datetime.now().isoformat(),
            "message": message,
            "level": level,
            "progress": self.progress.get(session_id, 0.0),
            "session_id": session_id
        }
        
        # 1. Store in memory buffer (limited to 100 entries)
        self.log_buffers[session_id].append(entry)
        if len(self.log_buffers[session_id]) > 100:
            self.log_buffers[session_id].pop(0)
            
        # 2. Broadcast via WebSocket
        topic = f"generation_logs_{session_id}"
        await connection_manager.broadcast({
            "type": "generation_log",
            "data": entry
        }, topic=topic)
        
        logger.info(f"[{session_id}] {message} ({self.progress.get(session_id, 0.0)}%)")

    def get_logs(self, session_id: str) -> List[Dict[str, Any]]:
        return self.log_buffers.get(session_id, [])

# Global instance
generation_log_service = GenerationLogService()
