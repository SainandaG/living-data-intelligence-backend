import os
import logging
import asyncpg
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.services.rbac_service import require_role, invalidate_permissions_cache

import json
from app.services.db_connector import db_connector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# DB Connection Helper (consistent with auth.py logic)
async def get_admin_db_conn():
    """Get a database connection, preferably from the pooled db_connector."""
    from app.services.db_connector import db_connector
    
    conn_id = db_connector.get_primary_connection_id()
    logger.info(f"Admin API using connection ID: {conn_id}")
    if conn_id:
        return conn_id, None # (connection_id, manual_conn)
        
    # Fallback to manual connection if pool is not ready
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", 5432))
    db_user = os.getenv("DB_USER")
    db_pass = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME", "wezu_backend")
    
    if not db_user:
        logger.error("DB_USER is not configured")
        raise HTTPException(status_code=500, detail="Database configuration missing")
    
    try:
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_pass,
            database=db_name,
            ssl='require' if 'neon.tech' in db_host else None
        )
        return None, conn
    except Exception as e:
        logger.error(f"Failed to connect to primary DB: {e}")
        raise HTTPException(status_code=503, detail="Primary database unavailable")

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
        select_sql = "SELECT name, permissions, description, is_system_role FROM roles"
        if conn_id:
            return await db_connector.query(conn_id, select_sql)
        else:
            rows = await manual_conn.fetch(select_sql)
            return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Error in list_roles: {e}")
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
        # Match the complex schema columns for custom roles
        sql = """
            INSERT INTO roles (name, permissions, description, level, is_system_role, is_active, category, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (name) DO UPDATE SET
                permissions = EXCLUDED.permissions,
                description = EXCLUDED.description
        """
        args = (name, json.dumps(permissions), description, 0, False, True, 'Custom', 'default')
        if conn_id:
            await db_connector.execute(conn_id, sql, *args)
        else:
            await manual_conn.execute(sql, *args)
            
        # Invalidate the RBAC permissions cache so changes take effect immediately
        await invalidate_permissions_cache(name)
        return {"success": True, "message": f"Role '{name}' saved successfully"}
    except Exception as e:
        logger.error(f"Error in upsert_role: {e}")
        raise HTTPException(status_code=500, detail="Failed to save role to database")
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
                    {"id": "login", "name": "User Login", "description": "Access to login and session management"},
                    {"id": "refresh", "name": "Token Refresh", "description": "Ability to refresh expired sessions"},
                    {"id": "dev_token", "name": "Dev Tokens", "description": "Generate development bypass tokens"},
                ]
            },
            {
                "id": "DATABASE",
                "name": "Database",
                "features": [
                    {"id": "connect", "name": "Connect Database", "description": "Establish new database connections"},
                    {"id": "manage", "name": "Manage Connections", "description": "View and delete existing connections"},
                    {"id": "seed", "name": "Seed Data", "description": "Populate demo data for testing"},
                ]
            },
            {
                "id": "SCHEMA",
                "name": "Schema",
                "features": [
                    {"id": "view_schema", "name": "View Schema", "description": "Get full schema (tables, columns, FKs)"},
                ]
            },
            {
                "id": "GRAPH",
                "name": "Graph Visualization",
                "features": [
                    {"id": "view_graph", "name": "View 3D Graph", "description": "Get 3D graph data (nodes + edges)"},
                    {"id": "generation_logs", "name": "Generation Logs", "description": "View graph generation logs"},
                    {"id": "edge_stats", "name": "Edge Statistics", "description": "Get edge statistics"},
                    {"id": "recalculate_gravity", "name": "Recalculate Gravity", "description": "Recalculate node gravity scores"},
                    {"id": "clusters", "name": "Semantic Clusters", "description": "Get semantic cluster data"},
                    {"id": "evolution_graph", "name": "Graph Evolution", "description": "Get graph evolution data"},
                    {"id": "node_detail", "name": "Node Detail", "description": "Detailed node metrics"},
                ]
            },
            {
                "id": "METRICS",
                "name": "Metrics",
                "features": [
                    {"id": "realtime_metrics", "name": "Real-time Metrics", "description": "Get real-time DB metrics"},
                ]
            },
            {
                "id": "VITALS",
                "name": "Vitals",
                "features": [
                    {"id": "system_vitals", "name": "System Vitals", "description": "System health vitals (CPU, RAM, latency)"},
                ]
            },
            {
                "id": "DRILLDOWN",
                "name": "Drill Down",
                "features": [
                    {"id": "table_records", "name": "Table Records", "description": "Get table rows (paginated)"},
                    {"id": "record_detail", "name": "Record Detail", "description": "Get single record detail"},
                    {"id": "search_records", "name": "Search Records", "description": "Search within table"},
                    {"id": "clustered_records", "name": "Clustered Records", "description": "Get clustered records by column"},
                    {"id": "gravity_calculate", "name": "Gravity Calculate", "description": "Calculate gravity for nodes"},
                    {"id": "semantic_discovery", "name": "Semantic Discovery", "description": "AI-powered table discovery"},
                    {"id": "column_intelligence", "name": "Column Intelligence", "description": "AI column analysis"},
                    {"id": "impact_analysis", "name": "Impact Analysis", "description": "Impact analysis for table"},
                ]
            },
            {
                "id": "MULTI_TABLE",
                "name": "Multi-Table Inspector",
                "features": [
                    {"id": "multi_schema", "name": "Multi-Table Schema", "description": "Multi-table schema overview"},
                    {"id": "multi_rows", "name": "Multi-Table Rows", "description": "Fetch rows from any table"},
                    {"id": "multi_detail", "name": "Row Detail", "description": "Single row with FK traversal"},
                ]
            },
            {
                "id": "SAVED_SELECTIONS",
                "name": "Saved Selections",
                "features": [
                    {"id": "view_selections", "name": "View Selections", "description": "List saved selections"},
                    {"id": "save_selection", "name": "Save Selection", "description": "Save a new selection"},
                    {"id": "delete_selection", "name": "Delete Selection", "description": "Delete a saved selection"},
                ]
            },
            {
                "id": "DATA_EXPLORER",
                "name": "Data Explorer",
                "features": [
                    {"id": "sample_data", "name": "Sample Data", "description": "Sample values from a column"},
                    {"id": "distinct_values", "name": "Distinct Values", "description": "Distinct values in a column"},
                ]
            },
            {
                "id": "DATA_FLOW",
                "name": "Data Flow",
                "features": [
                    {"id": "view_lineage", "name": "Data Lineage", "description": "Data lineage flow for table"},
                    {"id": "trace_path", "name": "Trace Path", "description": "Trace path between two tables"},
                ]
            },
            {
                "id": "HIERARCHY",
                "name": "Hierarchy",
                "features": [
                    {"id": "view_hierarchy", "name": "View Hierarchy", "description": "Parent/child hierarchy"},
                    {"id": "hierarchy_flow", "name": "Hierarchy Flow", "description": "Hierarchy flow diagram data"},
                    {"id": "hierarchy_animate", "name": "Hierarchy Animate", "description": "Animated hierarchy playback"},
                ]
            },
            {
                "id": "TABLE_GROUPS",
                "name": "Table Groups",
                "features": [
                    {"id": "view_groups", "name": "View Groups", "description": "List custom table groups"},
                    {"id": "create_group", "name": "Create Group", "description": "Create a new table group"},
                    {"id": "delete_group", "name": "Delete Group", "description": "Delete a table group"},
                ]
            },
            {
                "id": "INTELLIGENCE",
                "name": "Intelligence Suite",
                "features": [
                    {"id": "deep_status", "name": "Deep Status", "description": "Deep diagnostic status"},
                    {"id": "health_overview", "name": "Health Overview", "description": "System health overview"},
                    {"id": "data_analysis", "name": "Data Analysis", "description": "Table data analysis"},
                    {"id": "data_quality", "name": "Data Quality", "description": "Data quality score + issues"},
                    {"id": "bulk_analysis", "name": "Bulk Analysis", "description": "Neural bulk analysis report"},
                    {"id": "business_insights", "name": "Business Insights", "description": "Business patterns & trends"},
                    {"id": "patterns", "name": "Pattern Analysis", "description": "Traffic pattern analysis"},
                    {"id": "correlations", "name": "Correlations", "description": "Column correlation detection"},
                    {"id": "anomalies", "name": "Anomaly Detection", "description": "Current anomaly list"},
                    {"id": "predictions", "name": "Predictions", "description": "Growth forecasts (30-day)"},
                    {"id": "root_cause", "name": "Root Cause", "description": "Root cause & impact analysis"},
                    {"id": "recommendations", "name": "Recommendations", "description": "Global and table-specific action plans"},
                    {"id": "intel_hub", "name": "Intelligence Hub", "description": "Unified intelligence hub"},
                    {"id": "health_history", "name": "Health History", "description": "Health trend history"},
                    {"id": "latent_projection", "name": "Latent Projection", "description": "Latent space 3D projection"},
                    {"id": "latent_similar", "name": "Similar Nodes", "description": "Find semantically similar nodes"},
                    {"id": "semantic_search", "name": "Semantic Search", "description": "Semantic table search"},
                ]
            },
            {
                "id": "INTERNAL_NODE",
                "name": "Internal Node",
                "features": [
                    {"id": "node_clusters", "name": "Node Clusters", "description": "Internal node cluster data"},
                ]
            },
            {
                "id": "NODE_XRAY",
                "name": "Node X-Ray",
                "features": [
                    {"id": "xray_diagnostics", "name": "X-Ray Diagnostics", "description": "Full node X-ray diagnostics"},
                ]
            },
            {
                "id": "ONTOLOGY",
                "name": "Ontology",
                "features": [
                    {"id": "entity_mapping", "name": "Entity Mapping", "description": "Ontology entity mapping"},
                ]
            },
            {
                "id": "AI_SERVICES",
                "name": "AI Services",
                "features": [
                    {"id": "ai_chat", "name": "AI Chat", "description": "Natural language AI chat"},
                    {"id": "gravity_suggestions", "name": "Gravity Suggestions", "description": "AI gravity suggestions"},
                    {"id": "optimize_layout", "name": "Optimize Layout", "description": "Toggle layout optimization"},
                ]
            },
            {
                "id": "CHAT",
                "name": "Chat",
                "features": [
                    {"id": "data_chat", "name": "Data Chat", "description": "Simple chat interface for DB queries"},
                ]
            },
            {
                "id": "ML_GNN",
                "name": "ML  GNN",
                "features": [
                    {"id": "gnn_predict", "name": "GNN Predict", "description": "Predict single node importance"},
                    {"id": "gnn_batch", "name": "GNN Batch", "description": "Batch node importance prediction"},
                    {"id": "gnn_status", "name": "GNN Status", "description": "GNN model status"},
                ]
            },
            {
                "id": "ML_ANALYSIS",
                "name": "ML Analysis",
                "features": [
                    {"id": "ml_analyze", "name": "Run ML Analysis", "description": "Run ML analysis (Classification/Regression/Clustering/TimeSeries)"},
                    {"id": "ml_run", "name": "Start ML Job", "description": "Start async ML job"},
                    {"id": "ml_status", "name": "Job Status", "description": "Check ML job status"},
                    {"id": "ml_model", "name": "Download Model", "description": "Download trained model"},
                    {"id": "ml_suggest", "name": "Auto-Suggest", "description": "Auto-suggest ML config for a table"},
                    {"id": "ml_csv_upload", "name": "CSV Upload", "description": "Upload CSV for ML analysis"},
                    {"id": "ml_automl", "name": "AutoML", "description": "Run AutoML (auto algo selection)"},
                    {"id": "ml_experiments", "name": "Experiments", "description": "List and manage experiment runs"},
                    {"id": "ml_pdf", "name": "PDF Report", "description": "Download PDF report"},
                    {"id": "ml_health", "name": "ML Health", "description": "ML service health check"},
                    {"id": "ml_whatif", "name": "What-If", "description": "What-If scenario simulation"},
                ]
            },
            {
                "id": "EXPLAINABILITY",
                "name": "Explainability",
                "features": [
                    {"id": "explain_decision", "name": "Explain Decision", "description": "SHAP/LIME explanation for model"},
                    {"id": "explain_status", "name": "Explainability Status", "description": "Explainability service status"},
                    {"id": "justification", "name": "Node Justification", "description": "AI justification for a node"},
                    {"id": "reasoning_trace", "name": "Reasoning Trace", "description": "Trace decision path"},
                ]
            },
            {
                "id": "EVOLUTION",
                "name": "Evolution",
                "features": [
                    {"id": "evolution_analyze", "name": "Schema Evolution", "description": "Schema evolution analysis"},
                    {"id": "evolution_timeline", "name": "Timeline", "description": "Schema change timeline"},
                    {"id": "evolution_snapshot", "name": "Snapshot", "description": "Current schema snapshot"},
                    {"id": "evolution_playback", "name": "Playback", "description": "Schema playback animation data"},
                    {"id": "evolution_table", "name": "Table Evolution", "description": "Table-level evolution analysis"},
                    {"id": "evolution_insight", "name": "Evolution Insight", "description": "AI-powered evolution insight for table"},
                ]
            },
            {
                "id": "EVENTS",
                "name": "Events",
                "features": [
                    {"id": "process_event", "name": "Process Event", "description": "Process an incoming event"},
                    {"id": "event_status", "name": "Event Status", "description": "Event processing status"},
                ]
            },
            {
                "id": "DECISIONS",
                "name": "Decisions",
                "features": [
                    {"id": "list_decisions", "name": "List Decisions", "description": "List all decisions"},
                    {"id": "create_decision", "name": "Create Decision", "description": "Create a new decision"},
                    {"id": "decision_stats", "name": "Decision Stats", "description": "Decision statistics"},
                    {"id": "decision_stream", "name": "Decision Stream", "description": "SSE stream of live decisions"},
                    {"id": "decision_detail", "name": "Decision Detail", "description": "Get single decision detail"},
                    {"id": "decision_status", "name": "Update Status", "description": "Update decision status"},
                    {"id": "decision_dispatch", "name": "Dispatch Decision", "description": "Dispatch/execute a decision"},
                ]
            },
            {
                "id": "AGENT",
                "name": "Agent",
                "features": [
                    {"id": "agent_state", "name": "Agent State", "description": "Get autonomous agent state"},
                    {"id": "agent_logs", "name": "Agent Logs", "description": "Get agent activity logs"},
                    {"id": "agent_config", "name": "Agent Config", "description": "Get/update agent configuration"},
                    {"id": "agent_pause", "name": "Pause Agent", "description": "Pause the agent"},
                    {"id": "agent_resume", "name": "Resume Agent", "description": "Resume the agent"},
                    {"id": "agent_trigger", "name": "Trigger Agent", "description": "Manually trigger agent cycle"},
                ]
            },
            {
                "id": "APEX_AGENT",
                "name": "APEX Agent",
                "features": [
                    {"id": "apex_chat", "name": "APEX Chat", "description": "APEX agent chat"},
                    {"id": "apex_status", "name": "APEX Status", "description": "APEX agent status"},
                    {"id": "apex_sessions", "name": "APEX Sessions", "description": "List and manage APEX chat sessions"},
                ]
            },
            {
                "id": "SIMULATION",
                "name": "Simulation",
                "features": [
                    {"id": "sim_status", "name": "Simulation Status", "description": "Simulation running status"},
                    {"id": "sim_start", "name": "Start Simulation", "description": "Start data simulator"},
                    {"id": "sim_stop", "name": "Stop Simulation", "description": "Stop data simulator"},
                ]
            },
            {
                "id": "SEEDER",
                "name": "Seeder",
                "features": [
                    {"id": "seed_data", "name": "Seed Data", "description": "Seed database with demo data"},
                ]
            },
            {
                "id": "WORKSPACE",
                "name": "Workspace & Investigation",
                "features": [
                    {"id": "list_workspaces", "name": "List Workspaces", "description": "List all workspaces"},
                    {"id": "create_workspace", "name": "Create Workspace", "description": "Create a workspace"},
                    {"id": "manage_workspace", "name": "Manage Workspace", "description": "Update and delete workspace"},
                    {"id": "add_evidence", "name": "Add Evidence", "description": "Add evidence to investigation chain"},
                ]
            },
            {
                "id": "FILE_UPLOAD",
                "name": "File Upload",
                "features": [
                    {"id": "upload_file", "name": "Upload File", "description": "Upload CSV/Excel as connection"},
                    {"id": "file_schema", "name": "File Schema", "description": "Get uploaded file schema"},
                    {"id": "file_query", "name": "Query File", "description": "Query uploaded file data"},
                    {"id": "file_preview", "name": "Preview File", "description": "Preview uploaded file"},
                    {"id": "file_connections", "name": "File Connections", "description": "List file connections"},
                    {"id": "delete_file", "name": "Delete File", "description": "Delete file connection"},
                ]
            },
            {
                "id": "SECURITY",
                "name": "Security",
                "features": [
                    {"id": "masking", "name": "Column Masking", "description": "Configure field-level redaction policies"},
                    {"id": "audit", "name": "Audit Logs", "description": "View system-wide administrative activity"},
                    {"id": "rbac", "name": "RBAC Management", "description": "Access to the User Management Panel and Role Factory"},
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
        sql = "UPDATE users SET role = $1 WHERE email = $2"
        if conn_id:
            await db_connector.execute(conn_id, sql, role, email)
        else:
            await manual_conn.execute(sql, role, email)
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
        
        return {"success": True, "message": "Policy saved successfully"}
    finally:
        if manual_conn:
            await manual_conn.close()

@router.delete("/masking/{policy_id}")
async def delete_masking_policy(policy_id: str, _user: dict = Depends(require_role("admin"))):
    """Delete a masking policy."""
    conn_id, manual_conn = await get_admin_db_conn()
    try:
        sql = "DELETE FROM column_policies WHERE id = $1"
        if conn_id:
            await db_connector.execute(conn_id, sql, policy_id)
        else:
            await manual_conn.execute(sql, policy_id)
        return {"success": True, "message": "Policy deleted"}
    finally:
        if manual_conn:
            await manual_conn.close()
