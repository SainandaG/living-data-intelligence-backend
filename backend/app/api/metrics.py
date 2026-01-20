from fastapi import APIRouter, HTTPException
from app.services.realtime_monitor import realtime_monitor

router = APIRouter()

@router.get("/metrics/{connection_id}")
async def get_metrics(connection_id: str):
    """Get real-time metrics"""
    try:
        metrics = await realtime_monitor.get_realtime_data(connection_id)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
