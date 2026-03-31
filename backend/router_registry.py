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
    # Enforce JWT auth on all routes in production
    if os.getenv("APP_ENV", "development") == "production":
        from app.services.auth import get_current_user
        auth_dep = [Depends(get_current_user)]
        logger.info("Auth enforcement: ENABLED (production mode)")
    else:
        auth_dep = []
        logger.warning("Auth enforcement: DISABLED (development mode)")

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

    # ── ROUTE INVENTORY ───────────────────────────────────────────────────────
    logger.info("Finalizing route inventory...")
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            logger.info(f"Route registered: {list(route.methods)} {route.path}")
