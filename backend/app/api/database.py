from fastapi import APIRouter, HTTPException
from app.models.schemas import DatabaseConfig, ConnectionResponse
from app.services.db_connector import db_connector
from app.services.seeder import seeder

router = APIRouter()

@router.post("/connect", response_model=ConnectionResponse)
async def connect_database(config: DatabaseConfig):
    """Connect to a database"""
    try:
        print(f"🔌 Connection attempt: {config.db_type} to {config.database} at {config.host}")
        result = await db_connector.connect(config.dict())
        return ConnectionResponse(
            success=True,
            message="Database connected successfully",
            connection_id=result['id']
        )
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Connection failed: {error_msg}")
        raise HTTPException(
            status_code=500, 
            detail={
                "message": "Failed to connect to database",
                "error": error_msg,
                "type": type(e).__name__
            }
        )

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

@router.post("/seed/{connection_id}")
async def seed_database(connection_id: str):
    """Seed the database with temporal data for gravity/evolution playback"""
    try:
        result = await seeder.seed_database(connection_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query/{connection_id}")
async def debug_query(connection_id: str, sql: str):
    """Execute a raw SQL query for debugging"""
    try:
        return await db_connector.query(connection_id, sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
