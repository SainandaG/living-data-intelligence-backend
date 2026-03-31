from fastapi import APIRouter, HTTPException
from app.services.vitals_service import vitals_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vitals", tags=["vitals"])

@router.get("/")
async def get_vitals():
    """
    Get real-time system health metrics and agent statuses.
    """
    try:
        return await vitals_service.get_system_vitals()
    except Exception as e:
        logger.error(f"Vitals collection failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to collect system vitals")
