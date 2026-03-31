"""
health_endpoints.py
Health check and debug endpoints extracted from main.py.
Mounted via mount_health_endpoints(app, registry) during startup.
"""
import os
import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException

logger = logging.getLogger("app")


def mount_health_endpoints(app: FastAPI, registry):
    """Mount /api/health, /api/vitals/, /health, and dev-only debug endpoints."""

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

    if os.getenv("APP_ENV") == "development":
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
            """Debug endpoint — only available in development. Returns full traceback on graph failure."""
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
                steps_completed.append("latent_space_imported")

                # Step 8: Causal Intelligence
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


