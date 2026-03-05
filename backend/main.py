# Fix Windows console encoding issues
import sys
import os

# Configure UTF-8 encoding for Windows console
if sys.platform == 'win32':
    import io
    # Force UTF-8 encoding for stdout/stderr to handle Unicode characters (emojis, etc.)
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware  # [NEW] Compression
from contextlib import asynccontextmanager
import uvicorn
import asyncio
from dotenv import load_dotenv

# Ensure backend directory is in path and 'app' is findable
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Load environment variables BEFORE importing services
# Force override ensures local .env takes precedence over system env vars
load_dotenv(override=True)

import logging
from datetime import datetime
from app.services.connection_manager import connection_manager

logger = logging.getLogger(__name__)

# Using global connection_manager from services

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Living Data Intelligence Platform starting...")
    # Start background WebSocket maintenance loops
    await connection_manager.start()
    # Start background WebSocket streaming task
    from app.api.websocket import start_streaming_task
    await start_streaming_task()
    

    from app.services.agent_service import agent_service
    await agent_service.start_autonomous_loop()
    
    # Auto-Connect to Primary Database for Background Services
    try:
        from app.services.db_connector import db_connector
        
        # Check if already connected? No, easy to just try connecting.
        db_config = {
            "db_type": "postgres", # Force postgres/neon
            "host": os.getenv("DB_HOST"),
            "port": os.getenv("DB_PORT"),
            "username": os.getenv("DB_USER"),
            "password": os.getenv("DB_PASSWORD"),
            "database": os.getenv("DB_NAME")
        }
        
        # Only connect if credentials exist
        if db_config["host"] and db_config["username"]:
            print(f"🔌 Auto-connecting to database: {db_config['database']}...")
            await db_connector.connect(db_config)
            print("✅ Auto-connection successful.")

            # Start Data Simulator AFTER DB is connected so list_connections() returns results
            # DISABLED: User requested to run this manually rather than automatically
            # try:
            #     from app.services.data_simulator import data_simulator
            #     asyncio.create_task(data_simulator.start_simulation())
            #     print("⚡ Data Simulator started.")
            # except Exception as e:
            #     print(f"⚠️ Failed to start Data Simulator: {e}")
        else:
            print("⚠️ DB Credentials missing in .env, skipping auto-connect.")

    except Exception as e:
        print(f"⚠️ Auto-connect failed: {e}")


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
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    
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

# [NEW] Enable GZip Compression for performance
app.add_middleware(GZipMiddleware, minimum_size=1000)

class RouterRegistry:
    """
    Centralized router registry with validation
    Ensures all required routes are loaded before startup
    """
    def __init__(self, app: FastAPI):
        self.app = app
        self.required_routers = []
        self.optional_routers = []
        self.failed_routers = []
    
    def register_required(self, module_path: str, prefix: str = "", tags: list = None, router_name: str = "router"):
        """Register a required router (app won't start if missing)"""
        try:
            module = __import__(module_path, fromlist=[router_name])
            router = getattr(module, router_name)
            self.app.include_router(router, prefix=prefix, tags=tags or [])
            self.required_routers.append(module_path)
            logger.info(f"✅ Registered required router: {module_path}")
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"❌ CRITICAL: Failed to load required router {module_path}: {e}")
            self.failed_routers.append((module_path, str(e)))
            raise RuntimeError(f"Required router {module_path} failed to load") from e
    
    def register_optional(self, module_path: str, prefix: str = "", tags: list = None, router_name: str = "router"):
        """Register an optional router (app continues if missing)"""
        try:
            module = __import__(module_path, fromlist=[router_name])
            router = getattr(module, router_name)
            self.app.include_router(router, prefix=prefix, tags=tags or [])
            self.optional_routers.append(module_path)
            logger.info(f"✅ Registered optional router: {module_path}")
        except Exception as e:
            logger.warning(f"⚠️ Optional router {module_path} not loaded: {e}")
            self.failed_routers.append((module_path, str(e)))
    
    def get_status(self):
        """Get registration status"""
        return {
            "required_routers": self.required_routers,
            "optional_routers": self.optional_routers,
            "failed_routers": self.failed_routers,
            "total_registered": len(self.required_routers) + len(self.optional_routers),
            "status": "healthy" if not self.failed_routers else "degraded"
        }

# Initialize registry
registry = RouterRegistry(app)

# ============================================================================
# ROUTER REGISTRATION
# ============================================================================

# Required Routers
registry.register_required("app.api.database", prefix="/api", tags=["database"])
registry.register_required("app.api.schema", prefix="/api", tags=["schema"])
registry.register_required("app.api.graph", prefix="/api", tags=["graph"])
registry.register_required("app.api.metrics", prefix="/api", tags=["metrics"])
registry.register_required("app.api.drilldown", prefix="/api", tags=["drilldown"])
registry.register_required("app.api.hierarchy", prefix="/api", tags=["hierarchy"])
registry.register_required("app.api.internal_node", prefix="/api", tags=["internal-node"])
registry.register_required("app.api.ai", prefix="/api/ai", tags=["ai"])
registry.register_required("app.api.agent")
registry.register_required("app.api.websocket")

# Optional Routers
registry.register_optional("app.api.latent_stream", tags=["latent_stream"])
registry.register_optional("app.api.data_explorer", prefix="/api", tags=["data"])
registry.register_optional("app.api.data_flow", prefix="/api", tags=["data-flow"])
registry.register_optional("app.api.chat", prefix="/api", tags=["chat"])
registry.register_optional("app.api.evolution")
registry.register_optional("app.api.ml")
registry.register_optional("app.api.events")
registry.register_optional("app.api.explainability")
registry.register_optional("app.api.vitals")
registry.register_optional("app.api.intelligence", prefix="/api/intelligence", tags=["intelligence"])
registry.register_optional("app.api.ontology", prefix="/api/ontology", tags=["ontology"])
registry.register_optional("app.api.node_xray", prefix="/api", tags=["node-xray"])


# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================

@app.get("/health")
async def health_check():
    """System health check"""
    router_status = registry.get_status()
    return {
        "status": "healthy",
        "version": "2.0.0",
        "routers": router_status,
        "timestamp": datetime.now().isoformat()
    }


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
        reload_excludes=["*.log", "*.tmp"],
        log_level="info"
    )
