import os
from dotenv import load_dotenv

# Load environment variables FIRST before any local app imports
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import asyncio
import sys
from datetime import datetime

# sys.stdout = open("backend_output.log", "a", encoding="utf-8", buffering=1)
# sys.stderr = sys.stdout

def log_startup(msg):
    print(msg)
    with open("startup.log", "a", encoding="utf-8") as f:
        f.write(f"[{datetime.now().isoformat()}] {msg}\n")


with open("startup.log", "w", encoding="utf-8") as f:
    f.write(f"[{datetime.now().isoformat()}] --- STARTUP TRACE START ---\n")

log_startup("📦 Importing database API...")
from app.api import database
log_startup("📦 Importing schema API...")
from app.api import schema
log_startup("📦 Importing graph API...")
from app.api import graph
log_startup("📦 Importing metrics API...")
from app.api import metrics
log_startup("📦 Importing drilldown API...")
from app.api import drilldown
log_startup("📦 Importing hierarchy API...")
from app.api import hierarchy
log_startup("📦 Importing ai API...")
from app.api import ai
log_startup("📦 Importing data_explorer API...")
from app.api import data_explorer
log_startup("📦 Importing data_flow API...")
from app.api import data_flow
log_startup("📦 Importing chat API...")
from app.api import chat
log_startup("📦 Importing intelligence API...")
from app.api import intelligence
log_startup("📦 Importing connection manager...")
from app.services.connection_manager import ConnectionManager
log_startup("📦 All imports complete.")

load_dotenv()

# Connection manager for WebSocket
connection_manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    log_startup("🚀 Lifespan starting...")
    log_startup("🧠 Initializing Neural Core...")
    from app.services.neural_core import neural_core
    await neural_core.initialize()
    log_startup("🚀 Lifespan ready.")
    yield
    # Shutdown
    log_startup("👋 Shutting down...")
    log_startup("💾 Saving Neural Core states...")
    neural_core.save_all_states()
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
    return HTTPException(status_code=500, detail=str(exc))

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
app.include_router(intelligence.router, prefix="/api/intelligence", tags=["intelligence"])

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

@app.get("/ping")
async def ping():
    return {"ping": "pong"}

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    host = "127.0.0.1" # Force 127.0.0.1
    
    log_startup(f"🌐 Server preparing to run on http://{host}:{port}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False, # Disable reload for test
        log_level="info"
    )
