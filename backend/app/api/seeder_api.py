from fastapi import APIRouter, HTTPException, Body, Depends
from app.services.seeder import seeder
from app.services.rbac_service import require_role
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/seeder/seed")
async def seed_data(connection_id: str = Body(..., embed=True), _user: dict = Depends(require_role("admin"))):
    """Seed the database with sample evolution and WEZU data."""
    try:
        result = await seeder.seed_database(connection_id)
        return result
    except Exception as e:
        logger.error(f"Seeding failed for {connection_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to seed database")
