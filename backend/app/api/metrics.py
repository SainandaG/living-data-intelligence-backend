from fastapi import APIRouter, HTTPException, Depends
from app.services.realtime_monitor import realtime_monitor
from app.models.schemas import ErrorResponse
from app.services.rbac_service import require_role
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/metrics/{connection_id}", response_model=Dict[str, Any], responses={500: {"model": ErrorResponse}})
async def get_metrics(connection_id: str, _user: dict = Depends(require_role("viewer"))):
    """Get real-time metrics"""
    try:
        metrics = await realtime_monitor.get_realtime_data(connection_id)
        return metrics
    except Exception as e:
        logger.error(f"Metrics collection failed for {connection_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail="Failed to collect real-time metrics"
        )
