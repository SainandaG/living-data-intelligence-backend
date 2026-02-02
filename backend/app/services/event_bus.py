from typing import Dict, List, Callable, Any
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class EventBus:
    """
    Centralized Event Bus for system-wide communication.
    Supports publish/subscribe pattern for decoupling components.
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EventBus, cls).__new__(cls)
            cls._instance.subscribers = {}
            cls._instance.history = []
        return cls._instance
        
    def subscribe(self, event_type: str, callback: Callable):
        """Subscribe to an event type"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)
        logger.info(f"Subscribed to {event_type}")

    def unsubscribe(self, event_type: str, callback: Callable):
        """Unsubscribe"""
        if event_type in self.subscribers:
            try:
                self.subscribers[event_type].remove(callback)
            except ValueError:
                pass

    async def emit(self, event_type: str, data: Dict[str, Any]):
        """Emit an event to all subscribers"""
        event = {
            "type": event_type,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        
        # Store in history (brief retention)
        self.history.append(event)
        if len(self.history) > 100:
            self.history.pop(0)
            
        # Notify subscribers
        if event_type in self.subscribers:
            for callback in self.subscribers[event_type]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(event)
                    else:
                        callback(event)
                except Exception as e:
                    logger.error(f"Error handling event {event_type}: {e}")

# Global instance
event_bus = EventBus()
