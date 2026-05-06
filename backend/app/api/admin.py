
import os
import logging
import asyncpg
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.services.rbac_service import require_role, invalidate_permissions_cache

import json
from app.services.db_connector import db_connector
from app.services.masking_engine import invalidate_masking_cache
from app.services.platform.audit_logger import audit_logger, AuditEvent, AuditEventType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# DB Connection Helper (consistent with auth.py logic)
async def get_admin_db_conn():
    """Get a database connection, preferably from the pooled db_connector."""
    from app.services.db_connector import db_connector
    
    # 1. Try to find the primary connection in the pool
    conn_id = db_connector.get_primary_connection_id()
    
    # 2. If no 'primary' found by name, just use the first available postgres connection
    if not conn_id:
        all_conns = db_connector.list_connections()
        postgres_conns = [c for c in all_conns if c.get('type') == 'postgres']
        if postgres_conns:
            conn_id = postgres_conns[0]['id']
            logger.info(f" [RBAC] No primary DB found by name, defaulting to first postgres pool: {conn_id}")

    if conn_id:
        logger.debug(f" [RBAC] Admin API using pooled connection: {conn_id}")
        return conn_id, None
        
    # 3. Fallback to manual connection if no pool exists
    logger.warning(" [RBAC] No pooled connections found. Falling back to manual connection.")
    db_host = os.getenv("DB_HOST")
    db_port = int(os.getenv("DB_PORT", 5432))
    db_user = os.getenv("DB_USER")
    db_pass = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME", "wezu_backend")
    
    if not db_host or not db_user:
        logger.error("DB configuration missing in environment")
        raise HTTPException(status_code=500, detail="Database configuration missing")
    
    try:
        ssl_ctx = None
        if db_host and 'neon.tech' in db_host:
            import ssl
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = True
            ssl_ctx.verify_mode = ssl.CERT_REQUIRED

        # Use a very generous timeout for manual connections to avoid 'Database unreachable' toasts
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_pass,
            database=db_name,
            ssl=ssl_ctx,
            timeout=30  # Increased from 15 to 30 for stability
        )
        return None, conn
    except Exception as e:
        logger.error(f" [RBAC] Failed to connect to database manually: {e}")
        # Return a clearer error for the frontend
        raise HTTPException(
            status_code=503, 
            detail="Database connection failed. The system may be under heavy load or warming up.",
            headers={"Retry-After": "10"}
        )

@router.get("/users")
async def list_users(_user: dict = Depends(require_role("admin"))):
    """List all platform users."""
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        sql = "SELECT id, email, role, is_active, two_factor_enabled AS mfa_enabled, created_at FROM users"
        if conn_id:
            users = await db_connector.query(conn_id, sql)
            return users
        else:
            rows = await manual_conn.fetch(sql)
            users = [dict(r) for r in rows]
            return users
    finally:
        if manual_conn:
            await manual_conn.close()

@router.get("/roles")
async def list_roles(_user: dict = Depends(require_role("admin"))):
    """List all dynamic roles and their permissions."""
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        sql = "SELECT name, description, permissions, is_system_role, level FROM roles ORDER BY name"
        if conn_id:
            roles = await db_connector.query(conn_id, sql)
        else:
            rows = await manual_conn.fetch(sql)
            roles = [dict(r) for r in rows]
            
        # [FIX] Robustly ensure permissions is always a dictionary, even if double-encoded or None
        for r in roles:
            perms = r.get('permissions')
            # Deep decode in case it was accidentally stored as double-encoded JSON string
            while isinstance(perms, str):
                try:
                    perms = json.loads(perms)
                    if not isinstance(perms, (dict, list)):
                        # If it's a string literal like '"foo"', json.loads returns 'foo'
                        # We only want to keep going if it's still a JSON-like string
                        break
                except Exception as e:
                    logger.error(f"Failed to parse permissions for role {r.get('name')}: {e}")
                    perms = {}
                    break
            
            r['permissions'] = perms if isinstance(perms, dict) else {}
        
        return roles
    except Exception as e:
        logger.error(f"Error in list_roles: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch roles from database")
    finally:
        if manual_conn:
            await manual_conn.close()

@router.post("/roles")
async def upsert_role(role_data: Dict[str, Any], _user: dict = Depends(require_role("admin"))):
    """Create or update a dynamic role."""
    name = role_data.get("name")
    permissions = role_data.get("permissions", {})
    description = role_data.get("description", "")
    
    if not name:
        raise HTTPException(status_code=400, detail="Role name is required")
    
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        # Check if role exists and if it's a system role
        check_sql = "SELECT is_system_role FROM roles WHERE name = $1"
        if conn_id:
            res = await db_connector.query(conn_id, check_sql, (name,))
            if res and res[0]['is_system_role']:
                raise HTTPException(status_code=403, detail="System roles cannot be modified")
        else:
            row = await manual_conn.fetchrow(check_sql, name)
            if row and row['is_system_role']:
                raise HTTPException(status_code=403, detail="System roles cannot be modified")

        # [FIX] Deeply decode permissions to ensure we have a clean dictionary
        # This fixes the 'double encoding' bug where a stringified JSON was stored inside a JSONB column.
        final_permissions = permissions
        while isinstance(final_permissions, str):
            try:
                decoded = json.loads(final_permissions)
                if isinstance(decoded, (dict, list)):
                    final_permissions = decoded
                else:
                    # It's a string literal, we stop here
                    break
            except:
                break
        
        # If we got that weird index-based object {'0': '{', ...}, try to recover it
        if isinstance(final_permissions, dict) and '0' in final_permissions and '1' in final_permissions:
            logger.warning(f" [RBAC] Detected corrupted index-based permissions object for role {name}. Attempting recovery...")
            try:
                # Reconstruct string from indices and parse
                reconstructed = "".join([final_permissions[str(i)] for i in range(len(final_permissions)) if str(i) in final_permissions])
                final_permissions = json.loads(reconstructed)
                logger.info(f" [RBAC] Successfully recovered permissions for {name}")
            except Exception as rec_err:
                logger.error(f" [RBAC] Failed to recover permissions for {name}: {rec_err}")
                final_permissions = {}

        # Ensure final_permissions is a dictionary
        if not isinstance(final_permissions, dict):
            logger.warning(f" [RBAC] Permissions for {name} is not a dict (type: {type(final_permissions)}). Resetting to empty.")
            final_permissions = {}
            
        # To be safest with the ::jsonb cast in the SQL, we pass a clean JSON string.
        permissions_json = json.dumps(final_permissions)
        
        # Match the complex schema columns for custom roles
        sql = """
            INSERT INTO roles (name, permissions, description, level, is_system_role, is_active, category, tenant_id)
            VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (name) DO UPDATE SET
                permissions = EXCLUDED.permissions,
                description = EXCLUDED.description
        """
        
        args = (name, permissions_json, description, 0, False, True, 'Custom', 'default')
        logger.info(f" [DB EXECUTE] Role: {name}, Args Types: {[type(a) for a in args]}")
        
        if conn_id:
            res = await db_connector.execute(conn_id, sql, *args)
            logger.info(f" [DB RESULT] Pooled execute: {res}")
        else:
            res = await manual_conn.execute(sql, *args)
            logger.info(f" [DB RESULT] Manual execute: {res}")
            
        # Invalidate the RBAC permissions cache so changes take effect immediately
        await invalidate_permissions_cache(name)
        return {"success": True, "message": f"Role '{name}' saved successfully"}
    except Exception as e:
        logger.error(f"Error in upsert_role: {e}", exc_info=True)
        # Surface more specific errors if possible
        err_msg = str(e)
        if "unique constraint" in err_msg.lower():
            raise HTTPException(status_code=400, detail="A role with this name already exists")
        raise HTTPException(status_code=500, detail=f"Database error: {err_msg[:100]}")
    finally:
        if manual_conn:
            await manual_conn.close()

@router.get("/features")
async def get_features(_user: dict = Depends(require_role("admin"))):
    """Return the registry of controllable features (Full RBAC Feature Matrix).

    Covers all 134 API endpoints + 60 frontend components = 194 controllable features.
    """
    return {
        "categories": [
            {
                "id": "AUTHENTICATION",
                "name": "Authentication",
                "features": [
                    {"id": "login", "name": "User Login", "description": "Access to login and session management", "min_role": "viewer"},
                    {"id": "refresh", "name": "Token Refresh", "description": "Ability to refresh expired sessions", "min_role": "viewer"},
                    {"id": "register", "name": "Self Registration", "description": "Allow users to register themselves", "min_role": "viewer"},
                    {"id": "dev_token", "name": "Dev Tokens", "description": "Generate development bypass tokens", "min_role": "admin"},
                ]
            },
            {
                "id": "MFA",
                "name": "Multi-Factor Auth (MFA)",
                "features": [
                    {"id": "mfa_setup", "name": "Setup MFA", "description": "Generate MFA secrets and QR codes", "min_role": "viewer"},
                    {"id": "mfa_enable", "name": "Enable MFA", "description": "Confirm and activate MFA protection", "min_role": "viewer"},
                    {"id": "mfa_status", "name": "MFA Status", "description": "Check MFA status for accounts", "min_role": "viewer"},
                ]
            },
            {
                "id": "DATABASE",
                "name": "Database",
                "features": [
                    {"id": "connect", "name": "Connect Database", "description": "Establish new database connections", "min_role": "editor"},
                    {"id": "manage", "name": "Manage Connections", "description": "View and delete existing connections", "min_role": "editor"},
                    {"id": "seed", "name": "Seed Data", "description": "Populate demo data for testing", "min_role": "admin"},
                ]
            },
            {
                "id": "SCHEMA",
                "name": "Schema",
                "features": [
                    {"id": "view_schema", "name": "View Schema", "description": "Get full schema (tables, columns, FKs)", "min_role": "viewer"},
                ]
            },
            {
                "id": "GRAPH",
                "name": "Graph Visualization",
                "features": [
                    {"id": "view_graph", "name": "View 3D Graph", "description": "Get 3D graph data (nodes + edges)", "min_role": "viewer"},
                    {"id": "generation_logs", "name": "Generation Logs", "description": "View graph generation logs", "min_role": "viewer"},
                    {"id": "edge_stats", "name": "Edge Statistics", "description": "Get edge statistics", "min_role": "viewer"},
                    {"id": "recalculate_gravity", "name": "Recalculate Gravity", "description": "Recalculate node gravity scores", "min_role": "editor"},
                    {"id": "clusters", "name": "Semantic Clusters", "description": "Get semantic cluster data", "min_role": "viewer"},
                    {"id": "evolution_graph", "name": "Graph Evolution", "description": "Get graph evolution data", "min_role": "viewer"},
                    {"id": "node_detail", "name": "Node Detail", "description": "Detailed node metrics", "min_role": "viewer"},
                ]
            },
            {
                "id": "METRICS",
                "name": "Metrics",
                "features": [
                    {"id": "realtime_metrics", "name": "Real-time Metrics", "description": "Get real-time DB metrics", "min_role": "viewer"},
                    {"id": "anomaly_history", "name": "Anomaly History", "description": "View historical system anomalies", "min_role": "viewer"},
                ]
            },
            {
                "id": "STREAMS",
                "name": "Live Telemetry Streams",
                "features": [
                    {"id": "ws_metrics", "name": "Metrics Stream", "description": "Real-time WebSocket metrics feed", "min_role": "viewer"},
                    {"id": "ws_traffic", "name": "Traffic Stream", "description": "Real-time WebSocket traffic feed", "min_role": "viewer"},
                    {"id": "ws_intelligence", "name": "Intelligence Stream", "description": "Real-time AI insight feed", "min_role": "viewer"},
                ]
            },
            {
                "id": "VITALS",
                "name": "Vitals",
                "features": [
                    {"id": "system_vitals", "name": "System Vitals", "description": "System health vitals (CPU, RAM, latency)", "min_role": "viewer"},
                ]
            },
            {
                "id": "DRILLDOWN",
                "name": "Drill Down",
                "features": [
                    {"id": "table_records", "name": "Table Records", "description": "Get table rows (paginated)", "min_role": "viewer"},
                    {"id": "record_detail", "name": "Record Detail", "description": "Get single record detail", "min_role": "viewer"},
                    {"id": "search_records", "name": "Search Records", "description": "Search within table", "min_role": "viewer"},
                    {"id": "clustered_records", "name": "Clustered Records", "description": "Get clustered records by column", "min_role": "viewer"},
                    {"id": "gravity_calculate", "name": "Gravity Calculate", "description": "Calculate gravity for nodes", "min_role": "editor"},
                    {"id": "semantic_discovery", "name": "Semantic Discovery", "description": "AI-powered table discovery", "min_role": "analyst"},
                    {"id": "column_intelligence", "name": "Column Intelligence", "description": "AI column analysis", "min_role": "analyst"},
                    {"id": "impact_analysis", "name": "Impact Analysis", "description": "Impact analysis for table", "min_role": "analyst"},
                ]
            },
            {
                "id": "MULTI_TABLE",
                "name": "Multi-Table Inspector",
                "features": [
                    {"id": "multi_schema", "name": "Multi-Table Schema", "description": "Multi-table schema overview", "min_role": "viewer"},
                    {"id": "multi_rows", "name": "Multi-Table Rows", "description": "Fetch rows from any table", "min_role": "viewer"},
                    {"id": "multi_detail", "name": "Row Detail", "description": "Single row with FK traversal", "min_role": "viewer"},
                ]
            },
            {
                "id": "SAVED_SELECTIONS",
                "name": "Saved Selections",
                "features": [
                    {"id": "view_selections", "name": "View Selections", "description": "List saved selections", "min_role": "viewer"},
                    {"id": "save_selection", "name": "Save Selection", "description": "Save a new selection", "min_role": "editor"},
                    {"id": "delete_selection", "name": "Delete Selection", "description": "Delete a saved selection", "min_role": "editor"},
                ]
            },
            {
                "id": "DATA_EXPLORER",
                "name": "Data Explorer",
                "features": [
                    {"id": "sample_data", "name": "Sample Data", "description": "Sample values from a column", "min_role": "viewer"},
                    {"id": "distinct_values", "name": "Distinct Values", "description": "Distinct values in a column", "min_role": "viewer"},
                ]
            },
            {
                "id": "DATA_FLOW",
                "name": "Data Flow",
                "features": [
                    {"id": "view_lineage", "name": "Data Lineage", "description": "Data lineage flow for table", "min_role": "viewer"},
                    {"id": "trace_path", "name": "Trace Path", "description": "Trace path between two tables", "min_role": "viewer"},
                ]
            },
            {
                "id": "HIERARCHY",
                "name": "Hierarchy",
                "features": [
                    {"id": "view_hierarchy", "name": "View Hierarchy", "description": "Parent/child hierarchy", "min_role": "viewer"},
                    {"id": "hierarchy_flow", "name": "Hierarchy Flow", "description": "Hierarchy flow diagram data", "min_role": "viewer"},
                    {"id": "hierarchy_animate", "name": "Hierarchy Animate", "description": "Animated hierarchy playback", "min_role": "viewer"},
                ]
            },
            {
                "id": "TABLE_GROUPS",
                "name": "Table Groups",
                "features": [
                    {"id": "view_groups", "name": "View Groups", "description": "List custom table groups", "min_role": "viewer"},
                    {"id": "create_group", "name": "Create Group", "description": "Create a new table group", "min_role": "editor"},
                    {"id": "delete_group", "name": "Delete Group", "description": "Delete a table group", "min_role": "editor"},
                ]
            },
            {
                "id": "INTELLIGENCE",
                "name": "Intelligence Suite",
                "features": [
                    {"id": "deep_status", "name": "Deep Status", "description": "Deep diagnostic status", "min_role": "viewer"},
                    {"id": "health_overview", "name": "Health Overview", "description": "System health overview", "min_role": "viewer"},
                    {"id": "data_analysis", "name": "Data Analysis", "description": "Table data analysis", "min_role": "analyst"},
                    {"id": "data_quality", "name": "Data Quality", "description": "Data quality score + issues", "min_role": "analyst"},
                    {"id": "bulk_analysis", "name": "Bulk Analysis", "description": "Neural bulk analysis report", "min_role": "analyst"},
                    {"id": "business_insights", "name": "Business Insights", "description": "Business patterns & trends", "min_role": "analyst"},
                    {"id": "patterns", "name": "Pattern Analysis", "description": "Traffic pattern analysis", "min_role": "analyst"},
                    {"id": "correlations", "name": "Correlations", "description": "Column correlation detection", "min_role": "analyst"},
                    {"id": "anomalies", "name": "Anomaly Detection", "description": "Current anomaly list", "min_role": "viewer"},
                    {"id": "predictions", "name": "Predictions", "description": "Growth forecasts (30-day)", "min_role": "analyst"},
                    {"id": "root_cause", "name": "Root Cause", "description": "Root cause & impact analysis", "min_role": "analyst"},
                    {"id": "recommendations", "name": "Recommendations", "description": "Global and table-specific action plans", "min_role": "analyst"},
                    {"id": "intel_hub", "name": "Intelligence Hub", "description": "Unified intelligence hub", "min_role": "analyst"},
                    {"id": "health_history", "name": "Health History", "description": "Health trend history", "min_role": "viewer"},
                    {"id": "latent_projection", "name": "Latent Projection", "description": "Latent space 3D projection", "min_role": "viewer"},
                    {"id": "latent_similar", "name": "Similar Nodes", "description": "Find semantically similar nodes", "min_role": "viewer"},
                    {"id": "semantic_search", "name": "Semantic Search", "description": "Semantic table search", "min_role": "viewer"},
                ]
            },
            {
                "id": "INTERNAL_NODE",
                "name": "Internal Node",
                "features": [
                    {"id": "node_clusters", "name": "Node Clusters", "description": "Internal node cluster data", "min_role": "viewer"},
                ]
            },
            {
                "id": "NODE_XRAY",
                "name": "Node X-Ray",
                "features": [
                    {"id": "xray_diagnostics", "name": "X-Ray Diagnostics", "description": "Full node X-ray diagnostics", "min_role": "analyst"},
                ]
            },
            {
                "id": "ONTOLOGY",
                "name": "Ontology",
                "features": [
                    {"id": "entity_mapping", "name": "Entity Mapping", "description": "Ontology entity mapping", "min_role": "viewer"},
                ]
            },
            {
                "id": "AI_SERVICES",
                "name": "AI Services",
                "features": [
                    {"id": "ai_chat", "name": "AI Chat", "description": "Natural language AI chat", "min_role": "viewer"},
                    {"id": "gravity_suggestions", "name": "Gravity Suggestions", "description": "AI gravity suggestions", "min_role": "analyst"},
                    {"id": "optimize_layout", "name": "Optimize Layout", "description": "Toggle layout optimization", "min_role": "editor"},
                ]
            },
            {
                "id": "CHAT",
                "name": "Chat",
                "features": [
                    {"id": "data_chat", "name": "Data Chat", "description": "Simple chat interface for DB queries", "min_role": "viewer"},
                ]
            },
            {
                "id": "ML_GNN",
                "name": "ML  GNN",
                "features": [
                    {"id": "gnn_predict", "name": "GNN Predict", "description": "Predict single node importance", "min_role": "analyst"},
                    {"id": "gnn_batch", "name": "GNN Batch", "description": "Batch node importance prediction", "min_role": "analyst"},
                    {"id": "gnn_status", "name": "GNN Status", "description": "GNN model status", "min_role": "analyst"},
                ]
            },
            {
                "id": "ML_ANALYSIS",
                "name": "ML Analysis",
                "features": [
                    {"id": "ml_analyze", "name": "Run ML Analysis", "description": "Run ML analysis (Classification/Regression/Clustering/TimeSeries)", "min_role": "analyst"},
                    {"id": "ml_run", "name": "Start ML Job", "description": "Start async ML job", "min_role": "analyst"},
                    {"id": "ml_status", "name": "Job Status", "description": "Check ML job status", "min_role": "analyst"},
                    {"id": "ml_model", "name": "Download Model", "description": "Download trained model", "min_role": "analyst"},
                    {"id": "ml_suggest", "name": "Auto-Suggest", "description": "Auto-suggest ML config for a table", "min_role": "analyst"},
                    {"id": "ml_csv_upload", "name": "CSV Upload", "description": "Upload CSV for ML analysis", "min_role": "editor"},
                    {"id": "ml_automl", "name": "AutoML", "description": "Run AutoML (auto algo selection)", "min_role": "analyst"},
                    {"id": "ml_experiments", "name": "Experiments", "description": "List and manage experiment runs", "min_role": "analyst"},
                    {"id": "ml_pdf", "name": "PDF Report", "description": "Download PDF report", "min_role": "analyst"},
                    {"id": "ml_health", "name": "ML Health", "description": "ML service health check", "min_role": "viewer"},
                    {"id": "ml_whatif", "name": "What-If", "description": "What-If scenario simulation", "min_role": "analyst"},
                ]
            },
            {
                "id": "EXPLAINABILITY",
                "name": "Explainability",
                "features": [
                    {"id": "explain_decision", "name": "Explain Decision", "description": "SHAP/LIME explanation for model", "min_role": "analyst"},
                    {"id": "explain_status", "name": "Explainability Status", "description": "Explainability service status", "min_role": "analyst"},
                    {"id": "justification", "name": "Node Justification", "description": "AI justification for a node", "min_role": "analyst"},
                    {"id": "reasoning_trace", "name": "Reasoning Trace", "description": "Trace decision path", "min_role": "analyst"},
                ]
            },
            {
                "id": "EVOLUTION",
                "name": "Evolution",
                "features": [
                    {"id": "evolution_analyze", "name": "Schema Evolution", "description": "Schema evolution analysis", "min_role": "viewer"},
                    {"id": "evolution_timeline", "name": "Timeline", "description": "Schema change timeline", "min_role": "viewer"},
                    {"id": "evolution_snapshot", "name": "Snapshot", "description": "Current schema snapshot", "min_role": "viewer"},
                    {"id": "evolution_playback", "name": "Playback", "description": "Schema playback animation data", "min_role": "viewer"},
                    {"id": "evolution_table", "name": "Table Evolution", "description": "Table-level evolution analysis", "min_role": "viewer"},
                    {"id": "evolution_insight", "name": "Evolution Insight", "description": "AI-powered evolution insight for table", "min_role": "viewer"},
                ]
            },
            {
                "id": "EVENTS",
                "name": "Events",
                "features": [
                    {"id": "process_event", "name": "Process Event", "description": "Process an incoming event", "min_role": "editor"},
                    {"id": "event_status", "name": "Event Status", "description": "Event processing status", "min_role": "editor"},
                ]
            },
            {
                "id": "DECISIONS",
                "name": "Decisions",
                "features": [
                    {"id": "list_decisions", "name": "List Decisions", "description": "List all decisions", "min_role": "viewer"},
                    {"id": "create_decision", "name": "Create Decision", "description": "Create a new decision", "min_role": "analyst"},
                    {"id": "decision_stats", "name": "Decision Stats", "description": "Decision statistics", "min_role": "viewer"},
                    {"id": "decision_stream", "name": "Decision Stream", "description": "SSE stream of live decisions", "min_role": "viewer"},
                    {"id": "decision_detail", "name": "Decision Detail", "description": "Get single decision detail", "min_role": "viewer"},
                    {"id": "decision_status", "name": "Update Status", "description": "Update decision status", "min_role": "editor"},
                    {"id": "decision_dispatch", "name": "Dispatch Decision", "description": "Dispatch/execute a decision", "min_role": "editor"},
                ]
            },
            {
                "id": "AGENT",
                "name": "Agent",
                "features": [
                    {"id": "agent_state", "name": "Agent State", "description": "Get autonomous agent state", "min_role": "viewer"},
                    {"id": "agent_logs", "name": "Agent Logs", "description": "Get agent activity logs", "min_role": "viewer"},
                    {"id": "agent_config", "name": "Agent Config", "description": "Get/update agent configuration", "min_role": "analyst"},
                    {"id": "agent_pause", "name": "Pause Agent", "description": "Pause the agent", "min_role": "analyst"},
                    {"id": "agent_resume", "name": "Resume Agent", "description": "Resume the agent", "min_role": "analyst"},
                    {"id": "agent_trigger", "name": "Trigger Agent", "description": "Manually trigger agent cycle", "min_role": "analyst"},
                ]
            },
            {
                "id": "APEX_AGENT",
                "name": "APEX Agent",
                "features": [
                    {"id": "apex_chat", "name": "APEX Chat", "description": "APEX agent chat", "min_role": "viewer"},
                    {"id": "apex_status", "name": "APEX Status", "description": "APEX agent status", "min_role": "viewer"},
                    {"id": "apex_sessions", "name": "APEX Sessions", "description": "List and manage APEX chat sessions", "min_role": "viewer"},
                ]
            },
            {
                "id": "SIMULATION",
                "name": "Simulation",
                "features": [
                    {"id": "sim_status", "name": "Simulation Status", "description": "Simulation running status", "min_role": "viewer"},
                    {"id": "sim_start", "name": "Start Simulation", "description": "Start data simulator", "min_role": "editor"},
                    {"id": "sim_stop", "name": "Stop Simulation", "description": "Stop data simulator", "min_role": "editor"},
                ]
            },
            {
                "id": "SEEDER",
                "name": "Seeder",
                "features": [
                    {"id": "seed_data", "name": "Seed Data", "description": "Seed database with demo data", "min_role": "admin"},
                ]
            },
            {
                "id": "WORKSPACE",
                "name": "Workspace & Investigation",
                "features": [
                    {"id": "list_workspaces", "name": "List Workspaces", "description": "List all workspaces", "min_role": "viewer"},
                    {"id": "create_workspace", "name": "Create Workspace", "description": "Create a workspace", "min_role": "editor"},
                    {"id": "manage_workspace", "name": "Manage Workspace", "description": "Update and delete workspace", "min_role": "editor"},
                    {"id": "add_evidence", "name": "Add Evidence", "description": "Add evidence to investigation chain", "min_role": "editor"},
                ]
            },
            {
                "id": "FILE_UPLOAD",
                "name": "File Upload",
                "features": [
                    {"id": "upload_file", "name": "Upload File", "description": "Upload CSV/Excel as connection", "min_role": "editor"},
                    {"id": "file_schema", "name": "File Schema", "description": "Get uploaded file schema", "min_role": "viewer"},
                    {"id": "file_query", "name": "Query File", "description": "Query uploaded file data", "min_role": "viewer"},
                    {"id": "file_preview", "name": "Preview File", "description": "Preview uploaded file", "min_role": "viewer"},
                    {"id": "file_connections", "name": "File Connections", "description": "List file connections", "min_role": "viewer"},
                    {"id": "delete_file", "name": "Delete File", "description": "Delete file connection", "min_role": "editor"},
                ]
            },
            {
                "id": "SECURITY",
                "name": "Security",
                "features": [
                    {"id": "masking", "name": "Column Masking", "description": "Configure field-level redaction policies", "min_role": "admin"},
                    {"id": "audit", "name": "View Audit Logs", "description": "View system-wide administrative activity", "min_role": "admin"},
                    {"id": "audit_export", "name": "Export Audit Logs", "description": "Download audit trails for compliance", "min_role": "admin"},
                    {"id": "rbac", "name": "RBAC Management", "description": "Access to the User Management Panel and Role Factory", "min_role": "admin"},
                ]
            },
        ]
    }

@router.patch("/users/{email}/role")
async def update_user_role(email: str, role_data: Dict[str, Any], _user: dict = Depends(require_role("admin"))):
    """Update a user's role."""
    role = role_data.get("role")
    if not role:
        raise HTTPException(status_code=400, detail="Role name is required")
    
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        # Get old role for audit
        old_role = "unknown"
        get_old_sql = "SELECT role FROM users WHERE email = $1"
        if conn_id:
            old_res = await db_connector.query(conn_id, get_old_sql, email)
            if old_res: old_role = old_res[0]['role']
        else:
            old_row = await manual_conn.fetchrow(get_old_sql, email)
            if old_row: old_role = old_row['role']

        sql = "UPDATE users SET role = $1 WHERE email = $2"
        if conn_id:
            await db_connector.execute(conn_id, sql, role, email)
        else:
            await manual_conn.execute(sql, role, email)
            
        # Log role change
        await audit_logger.log(AuditEvent(
            event_type=AuditEventType.USER_ROLE_CHANGED,
            user_id=_user.get("sub"),
            role=_user.get("role"),
            resource_type="user",
            resource_id=email,
            metadata={"old_role": old_role, "new_role": role}
        ))

        return {"success": True, "message": f"User {email} updated to {role}"}
    finally:
        if manual_conn:
            await manual_conn.close()
@router.patch("/users/{email}/status")
async def update_user_status(email: str, status_data: Dict[str, Any], _user: dict = Depends(require_role("admin"))):
    """Toggle a user's active status."""
    is_active = status_data.get("is_active")
    if is_active is None:
        raise HTTPException(status_code=400, detail="is_active field is required")
    
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        sql = "UPDATE users SET is_active = $1 WHERE email = $2"
        if conn_id:
            await db_connector.execute(conn_id, sql, is_active, email)
        else:
            await manual_conn.execute(sql, is_active, email)
            
        # Log status change
        await audit_logger.log(AuditEvent(
            event_type=AuditEventType.USER_ACTIVATED if is_active else AuditEventType.USER_DEACTIVATED,
            user_id=_user.get("sub"),
            role=_user.get("role"),
            resource_type="user",
            resource_id=email
        ))

        return {"success": True, "message": f"User {email} status updated to {is_active}"}
    finally:
        if manual_conn:
            await manual_conn.close()
@router.post("/users/{email}/terminate")
async def terminate_user_sessions(email: str, _user: dict = Depends(require_role("admin"))):
    """Terminate all active sessions for a specific user."""
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        sql = "UPDATE users SET last_global_logout_at = NOW() WHERE email = $1"
        if conn_id:
            await db_connector.execute(conn_id, sql, email)
        else:
            await manual_conn.execute(sql, email)
        return {"success": True, "message": f"All sessions for {email} have been terminated."}
    finally:
        if manual_conn:
            await manual_conn.close()

@router.post("/system/terminate-all")
async def terminate_all_sessions(_user: dict = Depends(require_role("super_admin"))):
    """Terminate all active sessions for ALL users (Super Admin only)."""
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        sql = "UPDATE users SET last_global_logout_at = NOW()"
        if conn_id:
            await db_connector.execute(conn_id, sql)
        else:
            await manual_conn.execute(sql)
        return {"success": True, "message": "All sessions for all users have been terminated."}
    finally:
        if manual_conn:
            await manual_conn.close()
@router.get("/masking")
async def list_masking_policies(_user: dict = Depends(require_role("admin"))):
    """List all column-level masking policies."""
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        sql = "SELECT * FROM column_policies ORDER BY table_name, column_name"
        if conn_id:
            return await db_connector.query(conn_id, sql)
        else:
            rows = await manual_conn.fetch(sql)
            return [dict(r) for r in rows]
    finally:
        if manual_conn:
            await manual_conn.close()

@router.post("/masking")
async def save_masking_policy(policy: Dict[str, Any], _user: dict = Depends(require_role("admin"))):
    """Create or update a masking policy."""
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        # id is optional for new policies
        id = policy.get("id")
        connection_id = policy.get("connection_id")
        table_name = policy.get("table_name")
        column_name = policy.get("column_name")
        min_role = policy.get("min_role", "viewer")
        mask_strategy = policy.get("mask_strategy", "none")
        tenant_id = policy.get("tenant_id", "default")

        if not all([connection_id, table_name, column_name]):
            raise HTTPException(status_code=400, detail="connection_id, table_name, and column_name are required")

        if id:
            sql = "UPDATE column_policies SET min_role = $1, mask_strategy = $2 WHERE id = $3"
            args = (min_role, mask_strategy, id)
        else:
            sql = """
                INSERT INTO column_policies (connection_id, table_name, column_name, min_role, mask_strategy, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (connection_id, table_name, column_name, tenant_id) 
                DO UPDATE SET min_role = EXCLUDED.min_role, mask_strategy = EXCLUDED.mask_strategy
            """
            args = (connection_id, table_name, column_name, min_role, mask_strategy, tenant_id)
        
        if conn_id:
            await db_connector.execute(conn_id, sql, *args)
        else:
            await manual_conn.execute(sql, *args)
        
        # Invalidate the masking policy cache for this connection
        await invalidate_masking_cache(connection_id)
        
        # Emit audit event
        await audit_logger.log(AuditEvent(
            event_type=AuditEventType.POLICY_CREATED,
            connection_id=connection_id,
            user_id=_user.get("sub"),
            role=_user.get("role"),
            metadata={"action": "policy_save", "table": table_name, "column": column_name}
        ))
        
        return {"success": True, "message": "Policy saved successfully"}
    finally:
        if manual_conn:
            await manual_conn.close()

@router.delete("/masking/{policy_id}")
async def delete_masking_policy(policy_id: str, _user: dict = Depends(require_role("admin"))):
    """Delete a masking policy."""
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        # We need the connection_id to invalidate the cache. 
        # Fetch it before deleting if not available.
        conn_to_invalidate = None
        find_sql = "SELECT connection_id FROM column_policies WHERE id = $1"
        if conn_id:
            res = await db_connector.query(conn_id, find_sql, policy_id)
            if res: conn_to_invalidate = res[0]['connection_id']
        else:
            row = await manual_conn.fetchrow(find_sql, policy_id)
            if row: conn_to_invalidate = row['connection_id']

        sql = "DELETE FROM column_policies WHERE id = $1"
        if conn_id:
            await db_connector.execute(conn_id, sql, policy_id)
        else:
            await manual_conn.execute(sql, policy_id)
            
        if conn_to_invalidate:
            await invalidate_masking_cache(conn_to_invalidate)
            # Emit audit event
            await audit_logger.log(AuditEvent(
                event_type=AuditEventType.POLICY_DELETED,
                connection_id=conn_to_invalidate,
                user_id=_user.get("sub"),
                role=_user.get("role"),
                metadata={"action": "policy_delete", "policy_id": policy_id, "deleted": True}
            ))

        return {"success": True, "message": "Policy deleted"}
    finally:
        if manual_conn:
            await manual_conn.close()
