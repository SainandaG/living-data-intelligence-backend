from fastapi import APIRouter, HTTPException
from app.models.schemas import Schema
from app.services.schema_analyzer import schema_analyzer

router = APIRouter()

@router.get("/schema/{connection_id}", response_model=Schema)
async def get_schema(connection_id: str):
    """Get database schema analysis"""
    try:
        schema = await schema_analyzer.analyze_schema(connection_id)
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
