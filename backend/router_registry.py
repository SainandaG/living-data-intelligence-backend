"""
router_registry.py
All router registrations extracted from main.py.
Called once during startup via register_all_routes(app, registry, expected_routers).
"""
import os
import logging
from fastapi import Depends

logger = logging.getLogger(__name__)


def register_all_routes(app, registry, expected_routers: list):
    """Register all required and optional API routers."""
    from app.services.auth import get_current_user

    is_prod = os.getenv("APP_ENV", "development") == "production"
    disable_auth = os.getenv("DISABLE_AUTH", "false").lower() == "true"

    if is_prod and disable_auth:
        logger.critical("DISABLE_AUTH=true is FORBIDDEN in production. Ignoring.")
        disable_auth = False

    if disable_auth:
        auth_dep = []
        logger.warning("⚠️  Auth enforcement: DISABLED (DISABLE_AUTH=true). DO NOT use in production!")
    else:
        auth_dep = [Depends(get_current_user)]
        logger.info("🔒 Auth enforcement: ENABLED (all API routes require JWT)")

    # ── Required Routers ─────────────────────────────────────────────────────
    registry.register_required("app.api.auth", prefix="/api/auth", tags=["auth"])
    registry.register_required("app.api.database", prefix="/api", tags=["database"], dependencies=auth_dep)
    registry.register_required("app.api.schema", prefix="/api", tags=["schema"], dependencies=auth_dep)
    registry.register_required("app.api.graph", prefix="/api", tags=["graph"], dependencies=auth_dep)
    registry.register_required("app.api.metrics", prefix="/api", tags=["metrics"], dependencies=auth_dep)
    registry.register_required("app.api.drilldown", prefix="/api", tags=["drilldown"], dependencies=auth_dep)
    registry.register_required("app.api.hierarchy", prefix="/api", tags=["hierarchy"], dependencies=auth_dep)
    registry.register_required("app.api.internal_node", prefix="/api", tags=["internal-node"], dependencies=auth_dep)
    registry.register_required("app.api.ai", prefix="/api/ai", tags=["ai"], dependencies=auth_dep)
    registry.register_required("app.api.agent", dependencies=auth_dep)
    # ── Optional Routers ─────────────────────────────────────────────────────
    registry.register_optional("app.api.latent_stream", tags=["latent_stream"], dependencies=auth_dep)
    registry.register_required("app.api.websocket")  # WS token validated inside its own route
    registry.register_optional("app.api.data_explorer", prefix="/api", tags=["data"], dependencies=auth_dep)
    registry.register_optional("app.api.data_flow", prefix="/api", tags=["data-flow"], dependencies=auth_dep)
    registry.register_optional("app.api.chat", prefix="/api", tags=["chat"], dependencies=auth_dep)
    registry.register_optional("app.api.evolution", dependencies=auth_dep)
    registry.register_optional("app.api.ml", dependencies=auth_dep)
    registry.register_optional("app.api.ml_analysis", dependencies=auth_dep)  # Work on Data endpoints
    registry.register_optional("app.api.events", dependencies=auth_dep)
    registry.register_optional("app.api.explainability", dependencies=auth_dep)
    registry.register_optional("app.api.vitals", dependencies=auth_dep)
    registry.register_optional("app.api.intelligence", prefix="/api/intelligence", tags=["intelligence"], dependencies=auth_dep)
    registry.register_optional("app.api.ontology", prefix="/api/ontology", tags=["ontology"], dependencies=auth_dep)
    registry.register_optional("app.api.node_xray", prefix="/api", tags=["node-xray"], dependencies=auth_dep)
    registry.register_optional("app.api.simulation", prefix="/api", tags=["simulation"], dependencies=auth_dep)
    registry.register_optional("app.api.seeder_api", prefix="/api", tags=["seeder"], dependencies=auth_dep)

    # ── APEX Platform Routers ─────────────────────────────────────────────────
    registry.register_optional("app.api.apex_agent",  tags=["apex-agent"],  dependencies=auth_dep)
    registry.register_optional("app.api.decisions",   tags=["decisions"],   dependencies=auth_dep)
    registry.register_optional("app.api.workspace",   tags=["workspace"],   dependencies=auth_dep)

    # ── STARTUP VALIDATION ────────────────────────────────────────────────────
    registered_modules = registry.required_routers + registry.optional_routers
    missing_routers = []

    for expected in expected_routers:
        if not any(expected in mod for mod in registered_modules):
            missing_routers.append(expected)

    if missing_routers:
        logger.critical(f"CRITICAL: Missing expected routers: {missing_routers}")
        raise RuntimeError(f"Startup failed: System missing critical components {missing_routers}")

    # ── API VERSIONING ────────────────────────────────────────────────────────
    # Mount all /api/* routes under /api/v1/* as well for forward compatibility.
    # Clients can migrate to /api/v1/ at their own pace; /api/ remains as the
    # "latest" alias.
    from fastapi.routing import APIRoute
    versioned_routes = []
    for route in app.routes:
        if isinstance(route, APIRoute) and route.path.startswith("/api/"):
            # Create a v1 alias: /api/foo → /api/v1/foo
            v1_path = route.path.replace("/api/", "/api/v1/", 1)
            versioned_routes.append((v1_path, route))

    for v1_path, route in versioned_routes:
        app.add_api_route(
            v1_path,
            route.endpoint,
            methods=list(route.methods or []),
            tags=route.tags,
            dependencies=route.dependencies,
            summary=route.summary,
            description=route.description,
        )

    logger.info(f"API versioning: mounted {len(versioned_routes)} routes under /api/v1/")

    # ── ROUTE INVENTORY ───────────────────────────────────────────────────────
    logger.info("Finalizing route inventory...")
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            logger.info(f"Route registered: {list(route.methods)} {route.path}")
