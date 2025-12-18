from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import asyncio
import os
from dotenv import load_dotenv

from app.api import database, schema, graph, metrics, demo
from app.services.connection_manager import ConnectionManager

load_dotenv()

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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(database.router, prefix="/api", tags=["database"])
app.include_router(schema.router, prefix="/api", tags=["schema"])
app.include_router(graph.router, prefix="/api", tags=["graph"])
app.include_router(metrics.router, prefix="/api", tags=["metrics"])
app.include_router(demo.router, prefix="/api", tags=["demo"])

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

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve index.html for root
@app.get("/")
async def read_root():
    return FileResponse("static/index.html")

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
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
