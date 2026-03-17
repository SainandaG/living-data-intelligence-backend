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

# Configure structured logging — must happen before any module import
from app.config.logging import configure_logging, request_id_var, APP_VERSION, APP_ENV
configure_logging()
import logging
import time as _time
import uuid
logger = logging.getLogger("app")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.exceptions import RequestValidationError
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

from datetime import datetime
from app.services.db_connector import db_connector
from app.api.auth import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from fastapi import Depends
from app.services.auth import get_current_user

async def keep_alive_task():
    """Background task to keep database connections alive"""
    logger.info("🛰️ Starting database keep-alive task (every 4m)...")
    from app.services.db_connector import db_connector
    try:
        while True:
            await asyncio.sleep(240) # 4 minutes
            connections = db_connector.list_connections()
            if not connections:
                continue
                
            for conn in connections:
                try:
                    await db_connector.query(conn['id'], "SELECT 1")
                except Exception as e:
                    logger.warning(f"⚠️ Keep-alive failed for {conn['database']}: {e}")
    except asyncio.CancelledError:
        logger.info("🛑 Keep-alive task cancelled.")
        raise
    except Exception as e:
        logger.error(f"🔥 error in keep_alive_task: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Security Validation
    REQUIRED_SECRETS = ["GOOGLE_API_KEY", "JWT_SECRET_KEY"]
    for secret in REQUIRED_SECRETS:
        if not os.getenv(secret):
            logger.critical(f"Missing required secret: {secret}")
            raise RuntimeError(f"Missing required secret: {secret}")

    # Startup
    _startup_time = _time.monotonic()
    port = int(os.getenv("PORT", 8001))
    logger.info(f"startup | version={APP_VERSION} env={APP_ENV} port={port}")
    
    # Track ALL background tasks for clean cancellation
    app.state.bg_tasks = []

    # 1. Start streaming task
    from app.api.websocket import stream_metrics
    streaming_task = asyncio.create_task(stream_metrics())
    app.state.bg_tasks.append(streaming_task)
    
    # 2. Start keep-alive task
    keep_alive = asyncio.create_task(keep_alive_task())
    app.state.bg_tasks.append(keep_alive)

    # 3. Start Agent loop
    from app.services.agent_service import agent_service
    agent_loop_task = asyncio.create_task(agent_service.start_autonomous_loop())
    app.state.bg_tasks.append(agent_loop_task)
    
    # 4. Auto-Connect to Primary Database
    from app.services.db_connector import db_connector
        
    db_config = {
        "db_type": "postgres",
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT"),
        "username": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME")
    }
        
    if db_config["host"] and db_config["username"]:
        logger.info(f"🔌 Auto-connecting to database: {db_config['database']}...")
        try:
            conn_info = await db_connector.connect(db_config)
            logger.info("✅ Auto-connection established.")
            logger.info("🔥 Warming up primary database...")
            await db_connector.query(conn_info['id'], "SELECT 1")
            logger.info("✨ Primary database is warm and ready.")
        except Exception as e:
            logger.warning(f"⚠️ Auto-connect failed: {e}")
    else:
        logger.warning("⚠️ DB Credentials missing in .env, skipping auto-connect.")

    yield
    # Shutdown
    uptime = round(_time.monotonic() - _startup_time, 1)
    logger.info(f"shutdown | uptime_seconds={uptime}")
    
    # Cancel background tasks
    if hasattr(app.state, "bg_tasks") and app.state.bg_tasks:
        logger.info(f"🛑 Cancelling {len(app.state.bg_tasks)} background tasks...")
        for task in app.state.bg_tasks:
            task.cancel()
        
        # Wait for tasks to finish cancelling with timeout
        try:
            await asyncio.wait_for(asyncio.gather(*app.state.bg_tasks, return_exceptions=True), timeout=3.0)
            logger.info("✅ All background tasks cancelled.")
        except asyncio.TimeoutError:
            logger.warning("⚠️ Background task cancellation timed out.")

    # [CRITICAL] Close DB connections AFTER tasks are stopped
    from app.services.db_connector import db_connector
    try:
        logger.info("🔌 Closing all database connection pools...")
        await asyncio.wait_for(db_connector.close_all(), timeout=5.0)
        logger.info("✅ Database connections closed gracefully.")
    except asyncio.TimeoutError:
        logger.warning("⚠️ Shutdown timed out while closing DB connections.")
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {e}")

app = FastAPI(
    title="Living Data Intelligence Platform",
    description="Transform database schemas into interactive 3D visualizations",
    version="1.0.0",
    lifespan=lifespan
)

# Setup SlowAPI Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """
    Standardized Validation Error Handler to match the frontend expectations.
    """
    logger.warning(
        "Validation error",
        extra={"path": request.url.path, "errors": exc.errors()}
    )
    return JSONResponse(status_code=422, content={
        "error": "Invalid request data",
        "code": "VALIDATION_ERROR",
        "details": exc.errors()
    })

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler to prevent leaking internal stack traces.
    Logs full details internally for debugging.
    """
    logger.error(
        f"Unhandled exception: {str(exc)}",
        exc_info=True,
        extra={"path": request.url.path, "method": request.method}
    )
    
    # Check if it's already an HTTPException (which usually has a status code)
    status_code = 500
    detail = "An internal error occurred"
    error_code = "INTERNAL_ERROR"
    
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        detail = exc.detail
        # Try to map detail to a code or use a generic one
        error_code = getattr(exc, "code", "INTERNAL_ERROR")

    return JSONResponse(
        status_code=status_code,
        content={
            "error": detail,
            "code": error_code,
            "debug_traceback": f"{type(exc).__name__}: {str(exc)}",
            "path": request.url.path
        }
    )

# CORS middleware
# CORS middleware
# Support both comma-separated and JSON-list format in .env
_origins_raw = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS") or "http://localhost:5173"
logger.info(f"CORS raw origins: {_origins_raw}")

if _origins_raw.startswith("["):
    try:
        import json
        ALLOWED_ORIGINS = json.loads(_origins_raw)
    except Exception as e:
        logger.error(f"Failed to parse CORS origins JSON: {e}")
        ALLOWED_ORIGINS = ["http://localhost:5173"]
else:
    ALLOWED_ORIGINS = [o.strip() for o in _origins_raw.split(",")]

# Always ensure local dev origins are present
for dev_origin in ["http://localhost:5173", "http://127.0.0.1:5173"]:
    if dev_origin not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(dev_origin)

logger.info(f"Final ALLOWED_ORIGINS for CORS: {ALLOWED_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [NEW] Enable GZip Compression for performance
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request logging middleware with request_id tracking
@app.middleware("http")
async def log_requests(request: Request, call_next):
    req_id = str(uuid.uuid4())[:8]
    token = request_id_var.set(req_id)
    start = _time.monotonic()
    response = None
    try:
        response = await call_next(request)
    except Exception:
        raise
    finally:
        duration_ms = round((_time.monotonic() - start) * 1000, 2)
        logger.info(
            f"request | method={request.method} path={request.url.path} "
            f"status={getattr(response, 'status_code', '???')} duration_ms={duration_ms} req={req_id}"
        )
        request_id_var.reset(token)
    return response

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
    
    def register_required(self, module_path: str, prefix: str = "", tags: list = None, router_name: str = "router", dependencies: list = None):
        """Register a required router (app won't start if missing)"""
        try:
            module = __import__(module_path, fromlist=[router_name])
            router = getattr(module, router_name)
            self.app.include_router(router, prefix=prefix, tags=tags or [], dependencies=dependencies or [])
            self.required_routers.append(module_path)
            logger.info(f"✅ Registered required router: {module_path}")
        except Exception as e:
            logger.error(f"❌ CRITICAL: Failed to load required router {module_path}: {e}", exc_info=True)
            self.failed_routers.append((module_path, "Internal Registry Error"))
            raise RuntimeError(f"Required router {module_path} failed to load") from e
    
    def register_optional(self, module_path: str, prefix: str = "", tags: list = None, router_name: str = "router", dependencies: list = None):
        """Register an optional router (app continues if missing)"""
        try:
            module = __import__(module_path, fromlist=[router_name])
            router = getattr(module, router_name)
            self.app.include_router(router, prefix=prefix, tags=tags or [], dependencies=dependencies or [])
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
# ROUTER REGISTRATION & VALIDATION
# ============================================================================

# Define critical routers that MUST be present for production
EXPECTED_ROUTERS = ["database", "schema", "graph", "metrics", "websocket"]

# Required Routers
registry.register_required("app.api.auth", prefix="/api/auth", tags=["auth"])
auth_dep = [] # Disabled for development unblocking
registry.register_required("app.api.database", prefix="/api", tags=["database"], dependencies=auth_dep)
registry.register_required("app.api.schema", prefix="/api", tags=["schema"], dependencies=auth_dep)
registry.register_required("app.api.graph", prefix="/api", tags=["graph"], dependencies=auth_dep)
registry.register_required("app.api.metrics", prefix="/api", tags=["metrics"], dependencies=auth_dep)
registry.register_required("app.api.drilldown", prefix="/api", tags=["drilldown"], dependencies=auth_dep)
registry.register_required("app.api.hierarchy", prefix="/api", tags=["hierarchy"], dependencies=auth_dep)
registry.register_required("app.api.internal_node", prefix="/api", tags=["internal-node"], dependencies=auth_dep)
registry.register_required("app.api.ai", prefix="/api/ai", tags=["ai"], dependencies=auth_dep)
registry.register_required("app.api.agent", dependencies=auth_dep)
registry.register_required("app.api.websocket") # WS token validated inside its own route

# Optional Routers
registry.register_optional("app.api.latent_stream", tags=["latent_stream"], dependencies=auth_dep)
registry.register_optional("app.api.data_explorer", prefix="/api", tags=["data"], dependencies=auth_dep)
registry.register_optional("app.api.data_flow", prefix="/api", tags=["data-flow"], dependencies=auth_dep)
registry.register_optional("app.api.chat", prefix="/api", tags=["chat"], dependencies=auth_dep)
registry.register_optional("app.api.evolution", dependencies=auth_dep)
registry.register_optional("app.api.ml", dependencies=auth_dep)
registry.register_optional("app.api.events", dependencies=auth_dep)
registry.register_optional("app.api.explainability", dependencies=auth_dep)
registry.register_optional("app.api.vitals", dependencies=auth_dep)
registry.register_optional("app.api.intelligence", prefix="/api/intelligence", tags=["intelligence"], dependencies=auth_dep)
registry.register_optional("app.api.ontology", prefix="/api/ontology", tags=["ontology"], dependencies=auth_dep)
registry.register_optional("app.api.node_xray", prefix="/api", tags=["node-xray"], dependencies=auth_dep)
registry.register_optional("app.api.simulation", prefix="/api", tags=["simulation"], dependencies=auth_dep)
registry.register_optional("app.api.seeder_api", prefix="/api", tags=["seeder"], dependencies=auth_dep)

# STARTUP VALIDATION: Ensure critical routers were loaded
registered_modules = registry.required_routers + registry.optional_routers
missing_routers = []

for expected in EXPECTED_ROUTERS:
    # Check if expected router (e.g. "database") is in any of the registered module paths (e.g. "app.api.database")
    if not any(expected in mod for mod in registered_modules):
        missing_routers.append(expected)

if missing_routers:
    logger.critical(f"❌ CRITICAL: Missing expected routers: {missing_routers}")
    raise RuntimeError(f"Startup failed: System missing critical components {missing_routers}")

# ROUTE INVENTORY: Log all registered routes for audit
logger.info("🛰️  Finalizing route inventory...")
for route in app.routes:
    if hasattr(route, "methods") and hasattr(route, "path"):
        logger.info(f"Route registered: {list(route.methods)} {route.path}")


# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================

@app.get("/api/health")
async def health():
    """System health check and DB status"""
    from app.services.db_connector import db_connector
    connections = db_connector.list_connections()
    return {
        "status": "ok",
        "version": os.getenv("APP_VERSION", "2.1.0"),
        "db_connected": len(connections) > 0,
        "active_connections": len(connections),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/vitals/")
async def get_vitals():
    """
    Get real-time system health metrics and agent statuses.
    """
    try:
        from app.services.vitals_service import vitals_service
        return await vitals_service.get_system_vitals()
    except Exception as e:
        logger.error(f"Vitals collection failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to collect system vitals")

@app.get("/api/debug-singletons")
async def debug_singletons():
    import sys
    db_mods = {k: str(v) for k, v in sys.modules.items() if 'db_connector' in k}
    ids = {}
    for k, v in sys.modules.items():
        if 'db_connector' in k and v:
            if hasattr(v, 'db_connector'):
                ids[k] = id(v.db_connector)
    return {
        "modules": db_mods,
        "instance_ids": ids,
        "sys_path": sys.path
    }

@app.get("/api/debug-graph/{connection_id}")
async def debug_graph(connection_id: str):
    """Temporary debug endpoint — returns full traceback on graph failure"""
    import traceback
    steps_completed = []
    try:
        from app.services.graph_generator import graph_generator
        from app.services.cluster_store import cluster_store
        cluster_assignments = cluster_store.get_clusters(connection_id)
        clustering_method = cluster_store.get_method(connection_id)
        graph = await graph_generator.generate_graph(connection_id, cluster_assignments, clustering_method)
        steps_completed.append(f"graph_generation: {len(graph.get('nodes', []))} nodes, {len(graph.get('edges', []))} edges")

        # Step 2: Neural Core
        from app.services.neural_core import neural_core
        from app.services.realtime_monitor import realtime_monitor
        await neural_core.update_schema_context(
            {'tables': graph.get('nodes', [])},
            connection_id=connection_id,
            edges=graph.get('edges', [])
        )
        steps_completed.append("neural_core_context_updated")

        # Step 3: Real-Time Metrics
        real_metrics_data = await realtime_monitor.get_realtime_data(connection_id)
        steps_completed.append(f"realtime_metrics: {list(real_metrics_data.get('data', {}).keys())[:5]}")

        # Step 4: Core Metrics
        core_metrics = await neural_core.get_core_metrics(connection_id)
        steps_completed.append(f"core_metrics: status={core_metrics.get('status')}")

        # Step 5: Glow Calculator
        from visualization.glow_calculator import GlowCalculator
        glow_calc = GlowCalculator()
        nodes_for_calc = graph.get('nodes', [])
        edges_for_calc = graph.get('edges', [])
        for n in nodes_for_calc:
            n.setdefault('record_count', n.get('row_count', 0))
        glow_results = glow_calc.batch_calculate(nodes_for_calc, edges_for_calc)
        steps_completed.append(f"glow_calc: {len(glow_results.get('node_glows', {}))} nodes")

        # Step 6: WEZU Node Data
        wezu_node_data = await realtime_monitor.get_wezu_node_data(connection_id)
        steps_completed.append(f"wezu_data: {len(wezu_node_data)} tables")

        # Step 7: Latent Space (where crash likely is)
        from app.services.latent_space_service import latent_space_service
        steps_completed.append("latent_space_imported")

        # Step 8: Causal Intelligence
        from app.services.causal_intelligence import causal_intelligence
        steps_completed.append("causal_intelligence_imported")

        return {"status": "ok", "steps": steps_completed}
    except Exception as e:
        tb = traceback.format_exc()
        return {"status": "error", "error": str(e), "steps_completed": steps_completed, "traceback": tb}
@app.get("/health")
async def health_check():
    """Legacy health check"""
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
    
    logger.info(f"🌐 Server starting on http://{host}:{port}")
    logger.info(f"📊 Open http://localhost:{port} to view the application")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        reload_excludes=["*.log", "*.tmp"],
        log_level="info"
    )
