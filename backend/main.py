from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables BEFORE importing services
load_dotenv()

from app.api import database, schema, graph, metrics, drilldown, hierarchy, ai, data_explorer, data_flow, chat, agent, evolution
from app.services.connection_manager import ConnectionManager


# Connection manager for WebSocket
connection_manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Living Data Intelligence Platform starting...")
    yield
    # Shutdown
    print("👋 Shutting down...")
    from app.services.db_connector import db_connector
    await db_connector.close_all()

app = FastAPI(
    title="Living Data Intelligence Platform",
    description="Transform database schemas into interactive 3D visualizations",
    version="1.0.0",
    lifespan=lifespan
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    print(f"🔥 GLOBAL ERROR: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__}
    )

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(database.router, prefix="/api", tags=["database"])
app.include_router(schema.router, prefix="/api", tags=["schema"])
app.include_router(graph.router, prefix="/api", tags=["graph"])
app.include_router(metrics.router, prefix="/api", tags=["metrics"])
app.include_router(drilldown.router, prefix="/api", tags=["drilldown"])
app.include_router(hierarchy.router, prefix="/api", tags=["hierarchy"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(data_explorer.router, prefix="/api", tags=["data"])
app.include_router(data_flow.router, prefix="/api", tags=["data-flow"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(agent.router)
app.include_router(evolution.router)

# WebSocket endpoint for real-time updates
@app.websocket("/ws/{connection_id}")
async def websocket_endpoint(websocket: WebSocket, connection_id: str):
    await connection_manager.connect(websocket, connection_id)
    try:
        while True:
            # Keep connection alive and send updates
            from app.services.realtime_monitor import realtime_monitor
            data = await realtime_monitor.get_realtime_data(connection_id)
            await connection_manager.send_update(connection_id, data)
            await asyncio.sleep(int(os.getenv("REFRESH_INTERVAL", 5)))
    except WebSocketDisconnect:
        connection_manager.disconnect(connection_id)
        print(f"Client disconnected from {connection_id}")

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"🌐 Server starting on http://{host}:{port}")
    print(f"📊 Open http://localhost:{port} to view the application")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
