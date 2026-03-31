from fastapi import APIRouter, HTTPException, Body
from app.services.seeder import seeder
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/seeder/seed")
async def seed_data(connection_id: str = Body(..., embed=True)):
    """Seed the database with sample evolution and WEZU data."""
    try:
        result = await seeder.seed_database(connection_id)
        return result
    except Exception as e:
        logger.error(f"Seeding failed for {connection_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to seed database")
