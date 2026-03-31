from fastapi import APIRouter, HTTPException
from app.models.schemas import Schema, ErrorResponse
from app.services.schema_analyzer import schema_analyzer
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/schema/{connection_id}", response_model=Schema, responses={500: {"model": ErrorResponse}})
async def get_schema(connection_id: str):
    """Get database schema analysis"""
    try:
        schema = await schema_analyzer.analyze_schema(connection_id)
        return schema
    except Exception as e:
        logger.error(f"Schema analysis failed for {connection_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail="Failed to analyze database schema. Check connection health."
        )
