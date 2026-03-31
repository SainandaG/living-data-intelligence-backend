"""
Graph API Endpoints
Generates 3D graph visualizations from database schema with Neural Core Intelligence.
"""
from fastapi import APIRouter, HTTPException
from app.services.graph_generator import graph_generator
from app.models.schemas import ErrorResponse, StatusResponse
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _enrich_node(
    node: dict,
    connection_id: str,
    cluster_assignments: dict,
    clustering_method: str,
    node_glow_map: dict,
    live_metrics: dict,
    real_metrics_data: dict,
    wezu_node_data: dict,
) -> dict:
    """Apply glow, cluster color, GNN importance, authenticated metrics, and latent coords to one node."""
    from app.services.neural_core import neural_core
    from app.services.latent_space_service import latent_space_service
    from app.services.graph_intelligence import graph_intelligence

    try:
        node["node_glow"] = round(node_glow_map.get(node.get("id", "unknown"), 1.0), 2)
        table_name = node.get("name")
        cluster = cluster_assignments.get(table_name) if table_name and cluster_assignments else None
        if cluster:
            node["cluster"] = cluster
            node["color"] = graph_generator.get_cluster_color(cluster, clustering_method)

        # GNN importance (optional, may not be installed)
        try:
            from ml.graph_neural_core import graph_neural_core
            node["importance_score"] = graph_neural_core.predict_importance(
                node.get("id", "unknown"), node.get("type", "table"), node
            )
        except Exception:
            pass  # GNN not available, skip silently

        t_name = node.get("name", "")
        total_connections = sum(neural_core.in_degrees.get(connection_id, {}).values()) + sum(
            neural_core.out_degrees.get(connection_id, {}).values()
        )
        in_deg = neural_core.in_degrees.get(connection_id, {}).get(t_name, 0)
        out_deg = neural_core.out_degrees.get(connection_id, {}).get(t_name, 0)

        auth_metrics = graph_intelligence.get_authenticated_metrics(
            t_name,
            node.get("row_count", 0),
            in_deg,
            out_deg,
            total_system_connections=total_connections,
        )
        node["vitality"] = auth_metrics["vitality"]
        node["gravity_pull"] = auth_metrics["pull_factor"]
        node["importance_score"] = auth_metrics["gravity"]
        node["entropy"] = auth_metrics["entropy"]

        latent_coords = latent_space_service.calculate_latent_coordinates(
            node, live_metrics, real_metrics_data.get("anomalies", [])
        )
        node.update(latent_coords)
        node["latent_color"] = latent_space_service._get_semantic_color(node)

    except Exception as inner_e:
        t_name = node.get("name", "Unknown")
        logger.warning(f"Authenticated Enrichment Failed for {t_name}: {inner_e}")
        from app.services.graph_intelligence import graph_intelligence

        auth = graph_intelligence.get_authenticated_metrics(t_name, 0, 0, 0)
        node.update(
            {
                "vitality": auth["vitality"],
                "gravity_pull": auth["pull_factor"],
                "importance_score": auth["gravity"],
                "node_glow": 1.0,
                "latent_x": (hash(node.get("id", "unknown")) % 10000) - 5000,
                "latent_y": 100,
                "latent_z": 0,
            }
        )
    return node


def _apply_glow_to_edges(edges: list, edge_glow_map: dict) -> list:
    """Apply pre-calculated glow values to edges."""
    for edge in edges:
        try:
            edge["edge_glow"] = round(edge_glow_map.get(edge.get("id"), 1.0), 2)
        except (KeyError, TypeError):
            edge["edge_glow"] = 1.0
    return edges


def _build_graph_response(
    graph: dict,
    core_metrics: dict,
    health_report: dict,
    live_metrics: dict,
    enriched_nodes: list,
    enriched_edges: list,
    causal_history: list,
    manifold_data: dict,
) -> dict:
    """Assemble the final graph response dict."""
    graph["nodes"] = enriched_nodes
    graph["edges"] = enriched_edges
    graph["latent_manifold"] = manifold_data
    graph["intelligence_stream"] = causal_history[-10:] if causal_history else []
    graph["neural_core"] = {
        "status": core_metrics["status"],
        "health": health_report,
        "metrics": {
            "transaction_rate": live_metrics.get("transaction_rate", 0),
            "fraud_alerts": live_metrics.get("fraud_alerts", 0),
            "average_amount": live_metrics.get("average_amount", 0),
            "failed_transactions": live_metrics.get("failed_transactions", 0),
        },
        "ai_stats": core_metrics,
    }
    return graph


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/graph/{connection_id}", responses={500: {"model": ErrorResponse}})
async def get_graph(connection_id: str):
    """Generate 3D graph from schema with Neural Core Intelligence."""
    try:
        logger.info(f"Generating graph for connection: {connection_id}")

        from app.services.cluster_store import cluster_store

        cluster_assignments = cluster_store.get_clusters(connection_id)
        clustering_method = cluster_store.get_method(connection_id)

        graph = await graph_generator.generate_graph(connection_id, cluster_assignments, clustering_method)

        from app.services.neural_core import neural_core
        from app.services.realtime_monitor import realtime_monitor

        await neural_core.update_schema_context(
            {"tables": graph.get("nodes", [])},
            connection_id=connection_id,
            edges=graph.get("edges", []),
        )

        real_metrics_data = await realtime_monitor.get_realtime_data(connection_id)
        live_metrics = real_metrics_data.get("data", {})
        health_report = real_metrics_data.get("health", {"state": "unknown"})
        core_metrics = await neural_core.get_core_metrics(connection_id)

        from app.services.latent_space_service import latent_space_service
        from app.services.causal_intelligence import causal_intelligence

        wezu_node_data = await realtime_monitor.get_wezu_node_data(connection_id)

        from app.visualization.glow_calculator import GlowCalculator

        glow_calc = GlowCalculator()
        nodes_for_calc = graph.get("nodes", [])
        edges_for_calc = graph.get("edges", [])

        for n in nodes_for_calc:
            n.setdefault("record_count", n.get("row_count", 0))
            node_name = n.get("name")
            if node_name in wezu_node_data:
                n.update(wezu_node_data[node_name])
            gravity_map = neural_core.gravity_stores.get(connection_id, {})
            raw_imp = gravity_map.get(n.get("name"), 1.0)
            if isinstance(raw_imp, str):
                importance_map = {"critical": 3.0, "high": 2.2, "medium": 1.5, "low": 0.8}
                n["centrality"] = importance_map.get(raw_imp.lower(), 1.0)
            else:
                n["centrality"] = float(raw_imp)

        glow_results = glow_calc.batch_calculate(nodes_for_calc, edges_for_calc)
        node_glow_map = glow_results.get("node_glows", {})
        edge_glow_map = glow_results.get("edge_glows", {})

        enriched_nodes = []
        for node in nodes_for_calc:
            enriched_node = await _enrich_node(
                node,
                connection_id,
                cluster_assignments,
                clustering_method,
                node_glow_map,
                live_metrics,
                real_metrics_data,
                wezu_node_data,
            )
            enriched_nodes.append(enriched_node)

        enriched_edges = _apply_glow_to_edges(edges_for_calc, edge_glow_map)
        manifold_data = latent_space_service.generate_manifold_data(enriched_nodes)

        return _build_graph_response(
            graph,
            core_metrics,
            health_report,
            live_metrics,
            enriched_nodes,
            enriched_edges,
            causal_intelligence.causal_history,
            manifold_data,
        )

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error generating graph for {connection_id}: {error_msg}", exc_info=True)
        if "not found" in error_msg.lower() or "connection" in error_msg.lower():
            raise HTTPException(status_code=404, detail="Connection not found. Please re-connect.")
        raise HTTPException(status_code=500, detail=f"Graph generation failed: {error_msg}")


@router.get("/graph/generation-logs/{session_id}")
async def get_generation_logs(session_id: str):
    """Retrieve history of process logs for a generation session."""
    from app.services.generation_log_service import generation_log_service

    return {"session_id": session_id, "logs": generation_log_service.get_logs(session_id)}


@router.get(
    "/graph/neural-metrics/{connection_id}",
    response_model=Dict[str, Any],
    responses={500: {"model": ErrorResponse}},
)
async def get_neural_metrics(connection_id: str):
    """Get neural core metrics only (distinct from /api/metrics which returns realtime_monitor data)."""
    try:
        from app.services.neural_core import neural_core

        metrics = await neural_core.get_core_metrics(connection_id)
        return metrics
    except Exception as e:
        logger.error(f"Graph operation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal graph service error")


@router.post("/recalculate-gravity", response_model=StatusResponse, responses={500: {"model": ErrorResponse}})
async def recalculate_gravity(payload: dict):
    """Manually trigger neural core recalculation."""
    try:
        from app.services.neural_core import neural_core

        conn_id = payload.get("connection_id")
        logger.info(f"Manual Recalculation Triggered for {conn_id}")
        await neural_core.process_signal("manual_recalc", 1.0, connection_id=conn_id)
        return {"success": True, "message": "Neural Core recalculation started"}
    except Exception as e:
        logger.error(f"Graph operation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal graph service error")


@router.get(
    "/graph/cluster-metadata/{connection_id}",
    response_model=Dict[str, Any],
    responses={500: {"model": ErrorResponse}},
)
async def get_cluster_metadata(connection_id: str):
    """
    Get cluster metadata for 3D Tables visualization (tier3 lens).

    Returns semantic cluster groups with cluster names, table lists,
    colors, and 3D positions for layout.
    """
    try:
        from app.services.cluster_metadata_service import cluster_metadata_service
        from app.services.schema_analyzer import schema_analyzer

        schema = await schema_analyzer.analyze_schema(connection_id)
        schema_data = schema.dict() if hasattr(schema, "dict") else schema.model_dump()

        metadata = await cluster_metadata_service.get_cluster_groups(connection_id, schema_data)

        return {
            "status": "success",
            "connection_id": connection_id,
            "total_tables": metadata.get("total_tables", 0),
            "total_clusters": metadata.get("total_clusters", 0),
            "clusters": metadata.get("clusters", []),
            "error": metadata.get("error"),
        }

    except Exception as e:
        logger.error(f"Cluster metadata failure for {connection_id}: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "connection_id": connection_id,
            "total_tables": 0,
            "total_clusters": 0,
            "clusters": [],
            "error": "Failed to retrieve cluster metadata",
        }


@router.get(
    "/graph/{connection_id}/node-frequency/{table_name}",
    response_model=Dict[str, Any],
    responses={500: {"model": ErrorResponse}},
)
async def get_node_frequency(connection_id: str, table_name: str):
    """
    Real-time FK frequency distribution for single-node inspector.

    For each FK column in `table_name`, queries the live database to compute:
      - total_rows: full row count of the table
      - non_null_count: rows where this FK column is populated
      - distinct_count: unique FK values (cardinality)
      - fill_rate: non_null_count / total_rows * 100  (0-100 %)

    The fill_rate drives the frequency bar in the frontend — it reflects how
    often each FK relationship is actually used, not just the size of the
    referenced table.
    """
    from app.services.db_connector import db_connector
    from app.services.schema_analyzer import schema_analyzer

    try:
        # 1. Get the schema for this table (cached)
        schema = await schema_analyzer.get_schema(connection_id)
        table = next((t for t in schema.tables if t.name == table_name), None)
        if not table:
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")

        fk_columns = [col.name for col in table.columns if col.is_fk]
        fk_meta = {fk.column: {"referenced_table": fk.referenced_table, "referenced_column": fk.referenced_column}
                   for fk in table.foreign_keys}

        if not fk_columns:
            return {"table": table_name, "total_rows": 0, "fk_stats": []}

        # 2. Build a single aggregate query for all FK columns at once
        safe_table = f'"{table_name}"'
        select_parts = ['COUNT(*) AS total_rows']
        for col in fk_columns:
            safe_col = f'"{col}"'
            select_parts.append(f'COUNT({safe_col}) AS {col}__non_null')
            select_parts.append(f'COUNT(DISTINCT {safe_col}) AS {col}__distinct')

        sql = f"SELECT {', '.join(select_parts)} FROM {safe_table};"
        rows = await db_connector.query(connection_id, sql)
        row = rows[0] if rows else {}

        total_rows = int(row.get("total_rows", 0))

        # 3. Assemble per-FK stats
        fk_stats = []
        for col in fk_columns:
            non_null = int(row.get(f"{col}__non_null", 0))
            distinct = int(row.get(f"{col}__distinct", 0))
            fill_rate = round((non_null / total_rows * 100), 1) if total_rows > 0 else 0.0
            meta = fk_meta.get(col, {})
            fk_stats.append({
                "column": col,
                "referenced_table": meta.get("referenced_table", ""),
                "referenced_column": meta.get("referenced_column", ""),
                "total_rows": total_rows,
                "non_null_count": non_null,
                "distinct_count": distinct,
                "fill_rate": fill_rate,
            })

        return {"table": table_name, "total_rows": total_rows, "fk_stats": fk_stats}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"node-frequency failed for {table_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to compute node frequency: {str(e)}")
