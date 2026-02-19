import os
from fastapi import APIRouter, HTTPException
from app.models.schemas import DatabaseConfig, ConnectionResponse
from app.services.db_connector import db_connector
from app.services.seeder import seeder

router = APIRouter()

@router.post("/connect", response_model=ConnectionResponse)
async def connect_database(config: DatabaseConfig):
    """Connect to a database"""
    try:
        # AUTO-DETECT: If user tries to connect to localhost but we have a Neon DB config, use that instead
        # This fixes the issue where the frontend defaults to localhost but the backend is configured for Neon
        normalized_host = config.host.lower().strip()
        env_host = os.getenv("DB_HOST")
        
        if (normalized_host in ["localhost", "127.0.0.1", "::1"]) and env_host and "neon.tech" in env_host:
            print(f"🔄 Auto-switching from {config.host} to Neon DB from .env")
            config.host = env_host
            config.port = int(os.getenv("DB_PORT", 5432))
            config.database = os.getenv("DB_NAME", config.database)
            config.username = os.getenv("DB_USER", config.username)
            config.password = os.getenv("DB_PASSWORD", config.password)
            config.db_type = os.getenv("DB_TYPE", "postgresql")
            
        print(f"🔌 Connection attempt: {config.db_type} to {config.database} at {config.host}")
        
        try:
            result = await db_connector.connect(config.dict())
        except Exception as first_attempt_error:
            # RETRY LOGIC: If first attempt fails (e.g. user typed "e" or "localhost" refused)
            # and we have a valid .env config, try that.
            if env_host and config.host != env_host:
                print(f"⚠️ Initial connection failed ({first_attempt_error}). Retrying with .env configuration...")
                config.host = env_host
                config.port = int(os.getenv("DB_PORT", 5432))
                config.database = os.getenv("DB_NAME", config.database)
                config.username = os.getenv("DB_USER", config.username)
                config.password = os.getenv("DB_PASSWORD", config.password)
                config.db_type = os.getenv("DB_TYPE", "postgresql")
                
                # Retry
                result = await db_connector.connect(config.dict())
            else:
                raise first_attempt_error

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
