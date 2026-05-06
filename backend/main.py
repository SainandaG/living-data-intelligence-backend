# Fix Windows console encoding issues
# Triggering reload 
import sys
import os
import logging
import time as _time
import uuid

# Configure UTF-8 encoding for Windows console
if sys.platform == 'win32':
    # Force UTF-8 encoding for stdout/stderr to handle Unicode characters (emojis, etc.)
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        # Fallback for environments where reconfigure is not supported or fails
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Configure structured logging — must happen before any app module import
from app.config.logging import configure_logging, request_id_var, APP_VERSION, APP_ENV  # noqa: E402
configure_logging()
logger = logging.getLogger("app")

from fastapi import FastAPI, HTTPException, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.middleware.gzip import GZipMiddleware  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402
import asyncio  # noqa: E402


# Ensure backend directory is in path and 'app' is findable
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Load environment variables BEFORE importing services
# Force override ensures local .env takes precedence over system env vars
try:
    from dotenv import load_dotenv
    load_dotenv(override=False)  # Never override env vars already set by the container/system
except ImportError:
    logger.warning("⚠️ python-dotenv not found, environment variables must be set manually")



async def keep_alive_task():
    """Background task to keep database connections alive"""
    logger.info("Starting database keep-alive task (every 4m)...")
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
                    try:
                        logger.info(f"🔄 Reconnecting {conn['id']} ({conn['database']})...")
                        await db_connector.reconnect(conn['id'])
                    except Exception as re_err:
                        logger.error(f"❌ Reconnect failed for {conn['database']}: {re_err}")
    except asyncio.CancelledError:
        logger.info("🛑 Keep-alive task cancelled.")
        raise
    except Exception as e:
        logger.error(f"🔥 error in keep_alive_task: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Security Validation
    REQUIRED_SECRETS = ["GOOGLE_API_KEY", "JWT_SECRET_KEY"]
    is_dev = os.getenv("APP_ENV", "development") == "development"
    for secret in REQUIRED_SECRETS:
        val = os.getenv(secret)
        if not val:
            if is_dev:
                logger.warning(f"Missing secret: {secret} (allowed in development mode)")
                if secret == "JWT_SECRET_KEY":
                    import secrets as _secrets
                    os.environ["JWT_SECRET_KEY"] = _secrets.token_hex(32)
            else:
                logger.critical(f"Missing required secret: {secret}")
                raise RuntimeError(f"Missing required secret: {secret}")
        elif secret == "JWT_SECRET_KEY" and len(val) < 32:
            logger.critical("JWT_SECRET_KEY is too short (must be >= 32 chars)")
            raise RuntimeError("JWT_SECRET_KEY is too weak (must be >= 32 characters)")

    # Startup
    _startup_time = _time.monotonic()
    port = int(os.getenv("PORT", 8001))
    logger.info(f"startup | version={APP_VERSION} env={APP_ENV} port={port}")
    
    # Track ALL background tasks for clean cancellation
    app.state.bg_tasks = []

    def _make_task(coro_factory, name: str, *, restart: bool = True, max_restarts: int = 5):
        """Wrap a background coroutine with crash isolation and auto-restart.

        Args:
            coro_factory: An awaitable OR a zero-arg callable that returns an awaitable.
                          Using a callable allows restart to create a fresh coroutine.
            name: Human-readable task name for logging.
            restart: If True, automatically restart the task after a crash.
            max_restarts: Maximum consecutive restarts before giving up.
        """
        async def _guarded():
            restarts = 0
            while True:
                try:
                    # Support both raw coroutines (first run) and factories (restarts)
                    coro = coro_factory() if callable(coro_factory) and not asyncio.iscoroutine(coro_factory) else coro_factory
                    await coro
                    break  # Normal exit
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    restarts += 1
                    logger.error(
                        "background task %s crashed (attempt %d/%d): %s",
                        name, restarts, max_restarts, exc, exc_info=True
                    )
                    if not restart or restarts >= max_restarts:
                        logger.error("background task %s exceeded max restarts — giving up", name)
                        break
                    backoff = min(2 ** restarts, 32)
                    logger.info("restarting background task %s in %ds...", name, backoff)
                    await asyncio.sleep(backoff)
                    # If coro_factory is a plain coroutine (not callable), we can't restart
                    if not callable(coro_factory) or asyncio.iscoroutine(coro_factory):
                        logger.warning("background task %s was a one-shot coroutine — cannot restart", name)
                        break
        t = asyncio.create_task(_guarded(), name=name)
        app.state.bg_tasks.append(t)
        return t

    # 1. Start streaming task (restartable via factory)
    from app.api.websocket import stream_metrics
    _make_task(stream_metrics, "stream_metrics")

    # 2. Start keep-alive task (restartable via factory)
    _make_task(keep_alive_task, "keep_alive")

    from app.services.agent_service import agent_service
    _make_task(agent_service.start_autonomous_loop, "agent_loop")

    # 4. Start ephemeral model cleanup (1hr retention)
    from app.api.ml_analysis import cleanup_ephemeral_models
    _make_task(cleanup_ephemeral_models, "ml_model_cleanup")

    # 4b. Start data simulator if DEMO_MODE is true
    if os.getenv("DEMO_MODE", "false").lower() == "true":
        from app.services.data_simulator import data_simulator
        _make_task(data_simulator.start_simulation, "data_simulator")
    
    # Start APScheduler background jobs
    from app.services.scheduler import start_scheduler, stop_scheduler
    start_scheduler()
    
    # 5. Auto-Connect to Primary Database
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
            
            # Run essential migrations (schema creation)
            from app.services.db_migrations import run_essential_migrations
            await run_essential_migrations(conn_info['id'])

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
    
    # Stop APScheduler
    stop_scheduler()
    
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
from app.api.auth import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
logger.info("[OK] Rate limiting enabled (SlowAPI)")

_HTTP_STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
    503: "SERVICE_UNAVAILABLE",
}

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Return structured {error, code, path} for all HTTP exceptions so the frontend can read them."""
    code = getattr(exc, "code", None) or _HTTP_STATUS_CODES.get(exc.status_code, "HTTP_ERROR")
    return JSONResponse(status_code=exc.status_code, content={
        "error": exc.detail,
        "code": code,
        "path": str(request.url.path),
    })

@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """
    Standardized Validation Error Handler to match the frontend expectations.
    """
    error_details = exc.errors()
    logger.warning(
        f"Validation error: {error_details}",
        extra={"path": request.url.path, "errors": error_details}
    )
    return JSONResponse(status_code=422, content={
        "error": "Invalid request data",
        "code": "VALIDATION_ERROR",
        "details": error_details
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
            "path": request.url.path
        }
    )

# CORS middleware — supports comma-separated and JSON-list format in .env
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

# Add local dev origins only outside production
if os.getenv("APP_ENV", "development") != "production":
    for dev_origin in ["http://localhost:5173", "http://127.0.0.1:5173"]:
        if dev_origin not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(dev_origin)

logger.info(f"Final ALLOWED_ORIGINS for CORS: {ALLOWED_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID", "X-Tenant-ID"],
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
            logger.info(f"[OK] Registered optional router: {module_path}")
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

# ── Router registration (extracted to router_registry.py) ────────────────────
from router_registry import register_all_routes  # noqa: E402
register_all_routes(app, registry, EXPECTED_ROUTERS)

# ── Health & debug endpoints (extracted to health_endpoints.py) ──────────────
from health_endpoints import mount_health_endpoints  # noqa: E402
mount_health_endpoints(app, registry)

# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Server starting on http://{host}:{port}")
    logger.info(f"📊 Open http://localhost:{port} to view the application")
    
    is_dev = os.getenv("APP_ENV", "development") == "development"
    import uvicorn
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False, # [FIX] Disabled due to constant noise/restarts on Windows causing 500s
        reload_excludes=[
            "*.log", "*.tmp", "*.pyc", "*.pyo",
            "app.log", "app.log.*", "__pycache__",
            "*/__pycache__/*", "*/data/*", "*/static/*",
            "*/scratch/*", "*/.git/*", "*/node_modules/*",
            "*.db", "*.db-journal", "*.db-wal", "*.sqlite",
        ] if is_dev else [],
        log_level="info"
    )
