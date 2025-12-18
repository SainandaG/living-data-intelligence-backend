from fastapi import APIRouter, HTTPException
from app.models.schemas import DatabaseConfig, ConnectionResponse
from app.services.db_connector import db_connector

router = APIRouter()

@router.post("/connect", response_model=ConnectionResponse)
async def connect_database(config: DatabaseConfig):
    """Connect to a database"""
    try:
        result = await db_connector.connect(config.dict())
        return ConnectionResponse(
            success=True,
            message="Database connected successfully",
            connection_id=result['id']
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/connections")
async def list_connections():
    """List all active connections"""
    return db_connector.list_connections()

@router.delete("/disconnect/{connection_id}")
async def disconnect_database(connection_id: str):
    """Disconnect from database"""
    try:
        await db_connector.close(connection_id)
        return {"success": True, "message": "Disconnected successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
