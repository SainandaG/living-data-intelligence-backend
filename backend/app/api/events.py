"""
Events API - Transaction Event Processing
Connects to backend/events/tx_event_processor.py
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Import the orphaned event processor
try:
    try:
        from events.tx_event_processor import TxEventProcessor
    except ImportError:
        from backend.events.tx_event_processor import TxEventProcessor
    EVENTS_AVAILABLE = True
except ImportError:
    EVENTS_AVAILABLE = False
    logger.warning("⚠️ Warning: TxEventProcessor not available")

from ..config.feature_flags import USE_ADVANCED_EVENT_PROCESSING

router = APIRouter(prefix="/api/events", tags=["events"])

# Request/Response models
class EventProcessRequest(BaseModel):
    user_id: str
    action: str
    timestamp: Optional[str] = None
    timezone: str = "UTC"
    metadata: Optional[Dict[str, Any]] = None

class EventProcessResponse(BaseModel):
    event_id: str
    hashed_user_id: str
    encoded_action: list
    encoded_time: Dict[str, float]
    sampled: bool
    processing_time_ms: float

# Initialize processor if available
_processor = None
if EVENTS_AVAILABLE and USE_ADVANCED_EVENT_PROCESSING:
    try:
        _processor = TxEventProcessor()
        logger.info("✅ TxEventProcessor initialized successfully")
    except Exception as e:
        logger.warning(f"⚠️ TxEventProcessor initialization failed: {e}")

@router.post("/process", response_model=EventProcessResponse)
async def process_event(request: EventProcessRequest):
    """
    Process transaction event with privacy hashing and time encoding
    
    Example:
        POST /api/events/process
        {
            "user_id": "user123",
            "action": "view_patient",
            "timezone": "America/New_York",
            "metadata": {"patient_id": "p456"}
        }
    """
    if not USE_ADVANCED_EVENT_PROCESSING:
        raise HTTPException(
            status_code=503,
            detail="Event processing disabled. Set USE_ADVANCED_EVENT_PROCESSING=true"
        )
    
    if not EVENTS_AVAILABLE or _processor is None:
        raise HTTPException(
            status_code=503,
            detail="Event processor not available. Check backend/events/tx_event_processor.py"
        )
    
    try:
        import time
        start = time.time()
        
        # Build event
        event = {
            'user_id': request.user_id,
            'action': request.action,
            'timestamp': request.timestamp or datetime.now().isoformat(),
            'timezone': request.timezone,
            'metadata': request.metadata or {}
        }
        
        # Call the orphaned event processor
        processed = _processor.process_event(event)
        
        elapsed_ms = (time.time() - start) * 1000
        
        return EventProcessResponse(
            event_id=processed['event_id'],
            hashed_user_id=processed['hashed_user_id'],
            encoded_action=processed['encoded_action'],
            encoded_time=processed['encoded_time'],
            sampled=processed['sampled'],
            processing_time_ms=elapsed_ms
        )
    
    except Exception as e:
        logger.error(f"Event processing failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Transaction event processing failed")

@router.get("/status")
async def events_status():
    """Check event processing availability"""
    return {
        "available": EVENTS_AVAILABLE and _processor is not None,
        "enabled": USE_ADVANCED_EVENT_PROCESSING,
        "status": "ready" if (_processor is not None) else "not_initialized"
    }
