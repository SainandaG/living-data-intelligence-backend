from fastapi import APIRouter, HTTPException
from app.services.vitals_service import vitals_service

router = APIRouter(prefix="/api/vitals", tags=["vitals"])

@router.get("/")
async def get_vitals():
    """
    Get real-time system health metrics and agent statuses.
    """
    try:
        return await vitals_service.get_system_vitals()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
