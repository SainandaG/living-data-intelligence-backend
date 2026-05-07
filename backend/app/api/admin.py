import os
import logging
import asyncpg
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.services.rbac_service import require_role, invalidate_permissions_cache, _EFFECTIVE_LEVEL
from app.api.websocket import broadcast_role_change, broadcast_permission_change_for_role

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
    """List platform users scoped to the caller's tenant.

    Multi-tenant isolation: super_admins see all tenants; admins only see
    users within their own tenant_id.
    """
    from app.services.rbac_service import ROLE_HIERARCHY, _EFFECTIVE_LEVEL

    caller_role   = _user.get("role", "viewer")
    caller_level  = _EFFECTIVE_LEVEL.get(caller_role, 0)
    caller_tenant = _user.get("tenant_id", "default")

    conn_id, manual_conn = await get_admin_db_conn()
    try:
        if caller_level >= ROLE_HIERARCHY["super_admin"]:
            sql = "SELECT id, email, role, is_active, tenant_id, two_factor_enabled AS mfa_enabled, created_at FROM users"
            args: tuple = ()
        else:
            sql = "SELECT id, email, role, is_active, tenant_id, two_factor_enabled AS mfa_enabled, created_at FROM users WHERE tenant_id = $1"
            args = (caller_tenant,)

        if conn_id:
            users = await db_connector.query(conn_id, sql, *args)
            return users
        else:
            rows  = await manual_conn.fetch(sql, *args)
            users = [dict(r) for r in rows]
            return users
    finally:
        if manual_conn:
            await manual_conn.close()

@router.get("/roles")
async def list_roles(_user: dict = Depends(require_role("viewer"))):
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

        # Real-time push: notify all connected users with this role so their
        # UI reflects the new permission set without requiring a page reload.
        import asyncio
        asyncio.create_task(broadcast_permission_change_for_role(name, final_permissions))

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
async def get_features(_user: dict = Depends(require_role("viewer"))):
    """Return the registry of controllable features (Full RBAC Feature Matrix).

    Covers all 134 API endpoints + 60 frontend components = 194 controllable features.
    """
    return {
        "categories": [

            # ──────────────────────────────────────────────────────────────────────
            # AUTHENTICATION  (auth.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "AUTHENTICATION",
                "name": "🔐 Authentication",
                "features": [
                    {
                        "id": "login",
                        "name": "Login",
                        "description": "POST /auth/login — sign in and obtain access + refresh tokens",
                        "min_role": "viewer",
                        "method": "POST"
                    },
                    {
                        "id": "register",
                        "name": "Register",
                        "description": "POST /auth/register — create a new user account",
                        "min_role": "viewer",
                        "method": "POST"
                    },
                    {
                        "id": "refresh",
                        "name": "Token Refresh",
                        "description": "POST /auth/refresh — exchange refresh token for new access token",
                        "min_role": "viewer",
                        "method": "POST"
                    },
                    {
                        "id": "logout",
                        "name": "Logout",
                        "description": "POST /auth/logout — invalidate the refresh token / end session",
                        "min_role": "viewer",
                        "method": "POST"
                    },
                    {
                        "id": "dev_token",
                        "name": "Dev Token",
                        "description": "POST /auth/dev-token — generate a development bypass token",
                        "min_role": "admin",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # MULTI-FACTOR AUTH  (mfa_api.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "MFA",
                "name": "🛡️ Multi-Factor Auth (MFA)",
                "features": [
                    {
                        "id": "mfa_setup",
                        "name": "MFA Setup",
                        "description": "POST /mfa/setup — generate TOTP secret and QR code",
                        "min_role": "admin",
                        "method": "POST"
                    },
                    {
                        "id": "mfa_enable",
                        "name": "MFA Enable",
                        "description": "POST /mfa/enable — confirm and activate MFA on an account",
                        "min_role": "admin",
                        "method": "POST"
                    },
                    {
                        "id": "mfa_verify",
                        "name": "MFA Verify",
                        "description": "POST /mfa/verify — verify TOTP code during login",
                        "min_role": "viewer",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # DATABASE CONNECTIONS  (database.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "DATABASE",
                "name": "🗄️ Database Connections",
                "features": [
                    {
                        "id": "connections",
                        "name": "List Connections",
                        "description": "GET /connections — list all active database connections",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "connect",
                        "name": "Connect Database",
                        "description": "POST /connect — establish a new database connection",
                        "min_role": "admin",
                        "method": "POST"
                    },
                    {
                        "id": "disconnect",
                        "name": "Disconnect Database",
                        "description": "DELETE /disconnect/{id} — remove an existing database connection",
                        "min_role": "admin",
                        "method": "DELETE"
                    },
                    {
                        "id": "seed",
                        "name": "Seed Connection",
                        "description": "POST /seed/{id} — populate a connection with sample/demo data",
                        "min_role": "admin",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # SCHEMA  (schema.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "SCHEMA",
                "name": "📋 Schema",
                "features": [
                    {
                        "id": "view_schema",
                        "name": "View Schema",
                        "description": "GET /schema/{id} — fetch full DB schema: tables, columns, foreign keys",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # GRAPH VISUALIZATION  (graph.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "GRAPH",
                "name": "🕸️ Graph Visualization",
                "features": [
                    {
                        "id": "view_graph",
                        "name": "View 3D Graph",
                        "description": "GET /graph/{id} — full graph: nodes, edges, positions",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "generation_logs",
                        "name": "Graph Generation Logs",
                        "description": "GET /graph/generation-logs/{session} — graph build logs",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "neural_metrics",
                        "name": "Neural Metrics",
                        "description": "GET /graph/neural-metrics/{id} — neural core metrics (distinct from /api/metrics)",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "cluster_metadata",
                        "name": "Cluster Metadata",
                        "description": "GET /graph/cluster-metadata/{id} — semantic cluster groups for 3D Tables visualization",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "node_frequency",
                        "name": "Node FK Frequency",
                        "description": "GET /graph/{id}/node-frequency/{table} — real-time FK frequency distribution",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "pk_distribution",
                        "name": "PK Distribution",
                        "description": "GET /graph/{id}/pk-distribution/{table}/{col} — PK/FK value distribution",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "edge_stats",
                        "name": "Edge Statistics",
                        "description": "GET graph edge statistics and relationship counts",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "clusters",
                        "name": "Semantic Clusters",
                        "description": "GET semantic cluster data and groupings",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "recalculate_gravity",
                        "name": "Recalculate Gravity",
                        "description": "POST /recalculate-gravity — recompute all node gravity scores",
                        "min_role": "editor",
                        "method": "POST"
                    },
                    {
                        "id": "optimize_layout",
                        "name": "Optimize Layout",
                        "description": "POST /ai/optimize — toggle AI-driven graph layout optimization",
                        "min_role": "editor",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # METRICS  (metrics.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "METRICS",
                "name": "📊 Metrics",
                "features": [
                    {
                        "id": "realtime_metrics",
                        "name": "Real-time Metrics",
                        "description": "GET /metrics/{id} — live database performance metrics",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # SYSTEM VITALS  (vitals.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "VITALS",
                "name": "💓 System Vitals",
                "features": [
                    {
                        "id": "system_vitals",
                        "name": "System Vitals",
                        "description": "GET / — CPU, RAM, latency system health vitals",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # LIVE TELEMETRY STREAMS  (websocket.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "STREAMS",
                "name": "📡 Live Telemetry (WebSocket)",
                "features": [
                    {
                        "id": "ws_metrics",
                        "name": "Metrics Stream",
                        "description": "WS — real-time database metrics stream",
                        "min_role": "viewer",
                        "method": "WS"
                    },
                    {
                        "id": "ws_traffic",
                        "name": "Traffic Stream",
                        "description": "WS — real-time query traffic stream",
                        "min_role": "viewer",
                        "method": "WS"
                    },
                    {
                        "id": "ws_intelligence",
                        "name": "Intelligence Stream",
                        "description": "WS — real-time AI insight and anomaly stream",
                        "min_role": "viewer",
                        "method": "WS"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # DRILLDOWN  (drilldown.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "DRILLDOWN",
                "name": "🔍 Drill Down",
                "features": [
                    {
                        "id": "table_records",
                        "name": "Table Records",
                        "description": "GET /drilldown/{id}/table/{t} — paginated table rows",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "record_detail",
                        "name": "Record Detail",
                        "description": "GET /drilldown/{id}/table/{t}/record/{r} — single row detail",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "search_records",
                        "name": "Search Records",
                        "description": "GET /drilldown/{id}/table/{t}/search — keyword search within a table",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "clustered_records",
                        "name": "Clustered Records",
                        "description": "GET /drilldown/clustered-records/{id}/{t}/{col} — cluster rows by column",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "gravity_calculate",
                        "name": "Gravity Calculate",
                        "description": "POST /gravity/calculate — calculate gravity scores for selected nodes",
                        "min_role": "editor",
                        "method": "POST"
                    },
                    {
                        "id": "semantic_discovery",
                        "name": "Semantic Discovery",
                        "description": "GET /drilldown/{id}/semantic-discovery/{t} — AI-powered table discovery",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "column_intelligence",
                        "name": "Column Intelligence",
                        "description": "GET /drilldown/{id}/column-intelligence/{t}/{col} — AI column analysis",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "impact_analysis",
                        "name": "Impact Analysis",
                        "description": "GET /drilldown/{id}/impact-analysis/{t} — impact analysis for a table",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # MULTI-TABLE INSPECTOR  (multi_table_inspector.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "MULTI_TABLE",
                "name": "🗂️ Multi-Table Inspector",
                "features": [
                    {
                        "id": "multi_schema",
                        "name": "Multi-Table Schema",
                        "description": "GET /multi-table/schema/{id} — cross-table schema overview",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "multi_rows",
                        "name": "Multi-Table Rows",
                        "description": "GET /multi-table/rows/{id}/{t} — fetch rows from any table",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "multi_detail",
                        "name": "Row Detail (FK)",
                        "description": "GET /multi-table/row-detail/{id}/{t}/{pk} — single row with FK traversal",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # DATA EXPLORER  (data_explorer.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "DATA_EXPLORER",
                "name": "🧪 Data Explorer",
                "features": [
                    {
                        "id": "sample_data",
                        "name": "Sample Column Data",
                        "description": "GET /data/sample/{t}/{col} — sample values from a column",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "distinct_values",
                        "name": "Distinct Values",
                        "description": "GET /data/distinct/{t}/{col} — distinct values in a column",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # SAVED SELECTIONS  (saved_selections.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "SAVED_SELECTIONS",
                "name": "💾 Saved Selections",
                "features": [
                    {
                        "id": "view_selections",
                        "name": "View Selections",
                        "description": "GET /selections/{id}/{t} — list saved table selections",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "save_selection",
                        "name": "Save Selection",
                        "description": "POST /selections/{id}/{t} — save a new selection",
                        "min_role": "editor",
                        "method": "POST"
                    },
                    {
                        "id": "delete_selection",
                        "name": "Delete Selection",
                        "description": "DELETE /selections/{id}/{t}/{sel} — permanently delete a selection",
                        "min_role": "editor",
                        "method": "DELETE"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # DATA FLOW & LINEAGE  (data_flow.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "DATA_FLOW",
                "name": "🌊 Data Flow & Lineage",
                "features": [
                    {
                        "id": "view_lineage",
                        "name": "Data Lineage",
                        "description": "GET /data-flow/{id}/{t} — full lineage flow for a table",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "trace_path",
                        "name": "Trace Path",
                        "description": "GET /data-flow/path/{id}/{from}/{to} — trace path between two tables",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # HIERARCHY  (hierarchy.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "HIERARCHY",
                "name": "🌳 Hierarchy",
                "features": [
                    {
                        "id": "view_hierarchy",
                        "name": "View Hierarchy",
                        "description": "GET /hierarchy/{id}/table/{t} — parent/child hierarchy tree",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "hierarchy_flow",
                        "name": "Hierarchy Flow",
                        "description": "GET /hierarchy/{id}/table/{t}/flow — hierarchy flow diagram data",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "hierarchy_animate",
                        "name": "Hierarchy Animate",
                        "description": "GET /hierarchy/{id}/table/{t}/animate/{ts} — animated hierarchy playback",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # TABLE GROUPS  (table_groups.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "TABLE_GROUPS",
                "name": "📁 Table Groups",
                "features": [
                    {
                        "id": "view_groups",
                        "name": "View Groups",
                        "description": "GET /table-groups/{id} — list all custom table groups",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "create_group",
                        "name": "Create Group",
                        "description": "POST /table-groups/{id} — create a new table group",
                        "min_role": "editor",
                        "method": "POST"
                    },
                    {
                        "id": "delete_group",
                        "name": "Delete Group",
                        "description": "DELETE /table-groups/{id}/{gid} — delete a table group",
                        "min_role": "editor",
                        "method": "DELETE"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # INTELLIGENCE SUITE  (intelligence.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "INTELLIGENCE",
                "name": "🧠 Intelligence Suite",
                "features": [
                    {
                        "id": "deep_status",
                        "name": "Deep Status",
                        "description": "GET /deep-status/{id}/{t} — deep diagnostic status report",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "health_overview",
                        "name": "Health Overview",
                        "description": "GET /health/{id} — overall system health overview",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "health_history",
                        "name": "Health History",
                        "description": "GET /health/history/{id} — historical health trend data",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "anomalies",
                        "name": "Anomaly Detection",
                        "description": "GET /anomalies/{id} — current active anomaly list",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "anomaly_history",
                        "name": "Anomaly History",
                        "description": "Historical anomaly records over time",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "recommendations",
                        "name": "Recommendations",
                        "description": "GET /recommendations/{id} — global action plan recommendations",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "recommendations_table",
                        "name": "Table Recommendations",
                        "description": "GET /recommendations/{id}/{t} — table-specific recommendations",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "latent_projection",
                        "name": "Latent Projection",
                        "description": "GET /latent/projection — 3D latent space projection",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "semantic_search",
                        "name": "Semantic Search",
                        "description": "GET /semantic-search/{id} — AI-powered semantic table search",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "data_analysis",
                        "name": "Data Analysis",
                        "description": "GET /data-analysis/{id}/{t} — full table data analysis",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "data_quality",
                        "name": "Data Quality",
                        "description": "GET /data-quality/{id}/{t} — data quality score and issues",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "bulk_analysis",
                        "name": "Bulk Analysis",
                        "description": "GET /bulk-analysis/{id} — neural bulk analysis report",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "business_insights",
                        "name": "Business Insights",
                        "description": "GET /business-insights/{id}/{t} — business patterns and trends",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "patterns",
                        "name": "Pattern Analysis",
                        "description": "GET /patterns/{id}/{t} — traffic and query pattern analysis",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "correlations",
                        "name": "Correlations",
                        "description": "GET /correlations/{id}/{t} — column-level correlation detection",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "predictions",
                        "name": "Predictions",
                        "description": "GET /predictions/{id}/{t} — 30-day growth forecasts",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "root_cause",
                        "name": "Root Cause Analysis",
                        "description": "GET /root-cause/{id}/{t} — root cause and impact analysis",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "intel_hub",
                        "name": "Intelligence Hub",
                        "description": "GET /hub/{id} — unified intelligence hub dashboard",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "latent_similar",
                        "name": "Similar Nodes",
                        "description": "GET /latent/similar/{node} — find semantically similar nodes",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # INTERNAL NODE  (internal_node.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "INTERNAL_NODE",
                "name": "🔩 Internal Node",
                "features": [
                    {
                        "id": "node_clusters",
                        "name": "Node Clusters",
                        "description": "GET /internal-node/clusters/{id}/{t} — internal node cluster data",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # NODE X-RAY  (node_xray.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "NODE_XRAY",
                "name": "🔬 Node X-Ray",
                "features": [
                    {
                        "id": "xray_diagnostics",
                        "name": "X-Ray Diagnostics",
                        "description": "GET /node-xray/{id}/{t} — full node X-ray diagnostics report",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # ONTOLOGY  (ontology.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "ONTOLOGY",
                "name": "🕸️ Ontology",
                "features": [
                    {
                        "id": "entity_mapping",
                        "name": "Entity Mapping",
                        "description": "GET /ontology/{id} — ontology entity mapping",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # AI SERVICES  (ai.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "AI_SERVICES",
                "name": "🤖 AI Services",
                "features": [
                    {
                        "id": "ai_chat",
                        "name": "AI Chat",
                        "description": "POST /ai/chat — natural language AI chat interface",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "gravity_suggestions",
                        "name": "Gravity Suggestions",
                        "description": "GET /gravity-suggestions/{id} — AI gravity score suggestions",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # CHAT  (chat.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "CHAT",
                "name": "💬 Chat",
                "features": [
                    {
                        "id": "data_chat",
                        "name": "Data Chat",
                        "description": "POST /chat — natural language database query chat",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # ML — GNN  (ml.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "ML_GNN",
                "name": "🧬 ML — Graph Neural Network",
                "features": [
                    {
                        "id": "gnn_predict",
                        "name": "GNN Predict",
                        "description": "POST /gnn/predict — predict importance for a single node",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "gnn_batch",
                        "name": "GNN Batch Predict",
                        "description": "POST /gnn/predict/batch — batch node importance prediction",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "gnn_status",
                        "name": "GNN Status",
                        "description": "GET /gnn/status — GNN model availability and status",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # ML ANALYSIS  (ml_analysis.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "ML_ANALYSIS",
                "name": "🔬 ML Analysis",
                "features": [
                    {
                        "id": "ml_analyze",
                        "name": "Run ML Analysis",
                        "description": "POST /ml/analyze — Classification / Regression / Clustering / TimeSeries",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "ml_run",
                        "name": "Start Async Job",
                        "description": "POST /ml/run — start an async ML job (returns job id)",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "ml_status",
                        "name": "Job Status",
                        "description": "GET /ml/run/{id}/status — poll async ML job status",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "ml_model",
                        "name": "Download Model",
                        "description": "GET /ml/run/{id}/model — download the trained model file",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "ml_delete",
                        "name": "Delete ML Run",
                        "description": "DELETE /ml/run/{id} — permanently delete a completed ML run",
                        "min_role": "analyst",
                        "method": "DELETE"
                    },
                    {
                        "id": "ml_suggest",
                        "name": "Auto-Suggest",
                        "description": "GET /ml/suggest — auto-suggest ML algorithm for a table",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "ml_csv_upload",
                        "name": "CSV Upload",
                        "description": "POST /ml/csv/upload — upload a CSV file for ML analysis",
                        "min_role": "editor",
                        "method": "POST"
                    },
                    {
                        "id": "ml_automl",
                        "name": "AutoML",
                        "description": "POST /ml/automl — run AutoML (automatic algorithm selection)",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "ml_experiments",
                        "name": "List Experiments",
                        "description": "GET /ml/experiments — list all experiment runs",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "ml_experiments_best",
                        "name": "Best Experiment",
                        "description": "GET /ml/experiments/best — get the best-performing experiment",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "ml_pdf",
                        "name": "PDF Report",
                        "description": "GET /ml/run/{id}/pdf — download PDF analysis report",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "ml_health",
                        "name": "ML Health",
                        "description": "GET /ml/health — ML service health check",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "ml_whatif",
                        "name": "What-If Simulation",
                        "description": "POST /ml/whatif — run a What-If scenario simulation",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # EXPLAINABILITY  (explainability.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "EXPLAINABILITY",
                "name": "💡 Explainability",
                "features": [
                    {
                        "id": "explain_decision",
                        "name": "Explain Decision",
                        "description": "POST /explainability/explain — SHAP/LIME model explanation",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "explain_status",
                        "name": "Explainability Status",
                        "description": "GET /explainability/status — explainability service health",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "justification",
                        "name": "Node Justification",
                        "description": "GET /explainability/justification/{id}/{t} — AI node justification",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "reasoning_trace",
                        "name": "Reasoning Trace",
                        "description": "POST /explainability/trace — trace the decision reasoning path",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # SCHEMA EVOLUTION  (evolution.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "EVOLUTION",
                "name": "📈 Schema Evolution",
                "features": [
                    {
                        "id": "evolution_analyze",
                        "name": "Schema Evolution",
                        "description": "GET /evolution/analyze/{id} — full schema evolution analysis",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "evolution_timeline",
                        "name": "Evolution Timeline",
                        "description": "GET /evolution/timeline/{id} — schema change timeline",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "evolution_snapshot",
                        "name": "Schema Snapshot",
                        "description": "GET /evolution/snapshot/{id} — current schema snapshot",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "evolution_playback",
                        "name": "Evolution Playback",
                        "description": "GET /evolution/playback/{id} — animated schema playback data",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "evolution_table",
                        "name": "Table Evolution",
                        "description": "GET /evolution/analysis/table/{id}/{t} — table-level evolution",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                    {
                        "id": "evolution_insight",
                        "name": "Evolution Insight",
                        "description": "GET /evolution/analysis/insight/{id}/{t} — AI evolution insight",
                        "min_role": "analyst",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # EVENTS  (events.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "EVENTS",
                "name": "⚡ Events",
                "features": [
                    {
                        "id": "event_status",
                        "name": "Event Status",
                        "description": "GET /events/status — check event processing status",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "process_event",
                        "name": "Process Event",
                        "description": "POST /events/process — submit an event for processing",
                        "min_role": "editor",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # DECISIONS  (decisions.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "DECISIONS",
                "name": "⚖️ Decisions",
                "features": [
                    {
                        "id": "list_decisions",
                        "name": "List Decisions",
                        "description": "GET /decisions — list all decisions",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "decision_stats",
                        "name": "Decision Stats",
                        "description": "GET /decisions/stats — decision count and status statistics",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "decision_stream",
                        "name": "Decision Stream",
                        "description": "GET /decisions/stream — SSE live decision event stream",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "decision_detail",
                        "name": "Decision Detail",
                        "description": "GET /decisions/{id} — get a single decision full detail",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "create_decision",
                        "name": "Create Decision",
                        "description": "POST /decisions — create a new decision",
                        "min_role": "editor",
                        "method": "POST"
                    },
                    {
                        "id": "decision_status",
                        "name": "Update Status",
                        "description": "PATCH /decisions/{id}/status — update a decision status",
                        "min_role": "admin",
                        "method": "PATCH"
                    },
                    {
                        "id": "decision_dispatch",
                        "name": "Dispatch Decision",
                        "description": "POST /decisions/{id}/dispatch — dispatch and execute a decision",
                        "min_role": "admin",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # AUTONOMOUS AGENT  (agent.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "AGENT",
                "name": "🤖 Autonomous Agent",
                "features": [
                    {
                        "id": "agent_state",
                        "name": "Agent State",
                        "description": "GET /agent/state — current autonomous agent state",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "agent_logs",
                        "name": "Agent Logs",
                        "description": "GET /agent/logs — agent activity and command history",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "agent_commands",
                        "name": "Agent Commands",
                        "description": "GET /agent/commands — list all available agent commands",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "agent_stats",
                        "name": "Agent Stats",
                        "description": "GET /agent/statistics — agent performance statistics",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "agent_command",
                        "name": "Command Detail",
                        "description": "GET /agent/command/{id} — get detail for a specific command",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "agent_config",
                        "name": "Agent Config",
                        "description": "GET /agent/config — get system configuration",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "agent_intent",
                        "name": "Agent Intent",
                        "description": "POST /agent/intent — submit a natural language intent to agent",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "agent_execute",
                        "name": "Agent Execute",
                        "description": "POST /agent/execute — execute a specific agent action",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "agent_pause",
                        "name": "Pause Agent",
                        "description": "POST /agent/pause — pause the autonomous agent",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "agent_resume",
                        "name": "Resume Agent",
                        "description": "POST /agent/resume — resume the autonomous agent",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "agent_trigger",
                        "name": "Trigger Agent",
                        "description": "POST /agent/trigger — manually trigger an agent cycle",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "agent_clear",
                        "name": "Clear Context",
                        "description": "POST /agent/context/clear — clear agent context and memory",
                        "min_role": "admin",
                        "method": "POST"
                    },
                    {
                        "id": "agent_reset",
                        "name": "Reset Agent",
                        "description": "POST /agent/reset — fully reset agent to initial state",
                        "min_role": "admin",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # APEX AGENT  (apex_agent.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "APEX_AGENT",
                "name": "⚡ APEX Agent",
                "features": [
                    {
                        "id": "apex_chat",
                        "name": "APEX Chat Run",
                        "description": "POST /apex/run — start an APEX agent chat session",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "apex_sessions",
                        "name": "List APEX Sessions",
                        "description": "GET /apex/sessions — list all APEX chat sessions",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "apex_session_detail",
                        "name": "APEX Session Detail",
                        "description": "GET /apex/sessions/{id} — get a single APEX session detail",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "apex_delete_session",
                        "name": "Delete APEX Session",
                        "description": "DELETE /apex/sessions/{id} — permanently delete an APEX session",
                        "min_role": "admin",
                        "method": "DELETE"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # SIMULATION  (simulation.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "SIMULATION",
                "name": "🎮 Simulation",
                "features": [
                    {
                        "id": "sim_status",
                        "name": "Simulation Status",
                        "description": "GET /simulation/status — check if simulator is running",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "sim_start",
                        "name": "Start Simulation",
                        "description": "POST /simulation/start — start the data simulator",
                        "min_role": "editor",
                        "method": "POST"
                    },
                    {
                        "id": "sim_stop",
                        "name": "Stop Simulation",
                        "description": "POST /simulation/stop — stop the data simulator",
                        "min_role": "editor",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # SEEDER  (seeder_api.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "SEEDER",
                "name": "🌱 Seeder",
                "features": [
                    {
                        "id": "seed_data",
                        "name": "Seed Database",
                        "description": "POST /seeder/seed — seed a database connection with demo data",
                        "min_role": "admin",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # WORKSPACE & INVESTIGATION  (workspace.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "WORKSPACE",
                "name": "🔭 Workspace & Investigation",
                "features": [
                    {
                        "id": "list_workspaces",
                        "name": "List Workspaces",
                        "description": "GET /workspaces — list all investigation workspaces",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "create_workspace",
                        "name": "Create Workspace",
                        "description": "POST /workspaces — create a new investigation workspace",
                        "min_role": "viewer",
                        "method": "POST"
                    },
                    {
                        "id": "get_workspace",
                        "name": "Get Workspace",
                        "description": "GET /workspaces/{id} — get a single workspace detail",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "manage_workspace",
                        "name": "Update Workspace",
                        "description": "PATCH /workspaces/{id} — update workspace name or description",
                        "min_role": "viewer",
                        "method": "PATCH"
                    },
                    {
                        "id": "delete_workspace",
                        "name": "Delete Workspace",
                        "description": "DELETE /workspaces/{id} — permanently delete a workspace",
                        "min_role": "admin",
                        "method": "DELETE"
                    },
                    {
                        "id": "add_evidence",
                        "name": "Add Evidence",
                        "description": "POST /workspaces/{id}/evidence — add an evidence item to the chain",
                        "min_role": "admin",
                        "method": "POST"
                    },
                    {
                        "id": "delete_evidence",
                        "name": "Delete Evidence",
                        "description": "DELETE /workspaces/{id}/evidence/{eid} — remove an evidence item",
                        "min_role": "admin",
                        "method": "DELETE"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # FILE UPLOAD  (file_upload.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "FILE_UPLOAD",
                "name": "📂 File Upload (CSV / Excel)",
                "features": [
                    {
                        "id": "upload_file",
                        "name": "Upload File",
                        "description": "POST /files/upload — upload CSV or Excel as a database connection",
                        "min_role": "editor",
                        "method": "POST"
                    },
                    {
                        "id": "file_connections",
                        "name": "List File Connections",
                        "description": "GET /files/connections — list all file-based connections",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "file_preview",
                        "name": "Preview File",
                        "description": "GET /files/{id}/preview — preview rows from an uploaded file",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "file_query",
                        "name": "Query File",
                        "description": "POST /files/{id}/query — run SQL against a file-based connection",
                        "min_role": "analyst",
                        "method": "POST"
                    },
                    {
                        "id": "file_schema",
                        "name": "File Schema",
                        "description": "GET /files/{id}/schema — get schema of an uploaded file",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "delete_file",
                        "name": "Delete File",
                        "description": "DELETE /files/{id} — close and delete a file-based connection",
                        "min_role": "admin",
                        "method": "DELETE"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # ADMIN — USER MANAGEMENT  (admin.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "ADMIN_USERS",
                "name": "👥 Admin — User Management",
                "features": [
                    {
                        "id": "list_users",
                        "name": "List Users",
                        "description": "GET /admin/users — list all users in the tenant",
                        "min_role": "admin",
                        "method": "GET"
                    },
                    {
                        "id": "update_user_role",
                        "name": "Update User Role",
                        "description": "PATCH /admin/users/{email}/role — assign a role to a user",
                        "min_role": "admin",
                        "method": "PATCH"
                    },
                    {
                        "id": "update_user_status",
                        "name": "Enable / Disable User",
                        "description": "PATCH /admin/users/{email}/status — enable or disable a user account",
                        "min_role": "admin",
                        "method": "PATCH"
                    },
                    {
                        "id": "terminate_session",
                        "name": "Terminate User Session",
                        "description": "POST /admin/users/{email}/terminate — force-logout a specific user",
                        "min_role": "admin",
                        "method": "POST"
                    },
                    {
                        "id": "terminate_all",
                        "name": "Terminate All Sessions",
                        "description": "POST /admin/system/terminate-all — force-logout all active users",
                        "min_role": "super_admin",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # ADMIN — ROLE FACTORY  (admin.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "ADMIN_ROLES",
                "name": "🏭 Admin — Role Factory",
                "features": [
                    {
                        "id": "list_roles",
                        "name": "List Roles",
                        "description": "GET /admin/roles — list all roles and their permission sets",
                        "min_role": "viewer",
                        "method": "GET"
                    },
                    {
                        "id": "create_role",
                        "name": "Create / Edit Role",
                        "description": "POST /admin/roles — create or update a custom role",
                        "min_role": "admin",
                        "method": "POST"
                    },
                    {
                        "id": "rbac",
                        "name": "RBAC Page Access",
                        "description": "Access the full RBAC user management and role factory pages",
                        "min_role": "admin",
                        "method": "GET"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # COLUMN MASKING  (admin.py masking routes)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "MASKING",
                "name": "🎭 Column Masking",
                "features": [
                    {
                        "id": "masking_read",
                        "name": "View Masking Policies",
                        "description": "GET /admin/masking — list all column redaction policies",
                        "min_role": "admin",
                        "method": "GET"
                    },
                    {
                        "id": "masking",
                        "name": "Create Masking Policy",
                        "description": "POST /admin/masking — create a new column masking policy",
                        "min_role": "admin",
                        "method": "POST"
                    },
                    {
                        "id": "masking_delete",
                        "name": "Delete Masking Policy",
                        "description": "DELETE /admin/masking/{id} — remove a column masking policy",
                        "min_role": "admin",
                        "method": "DELETE"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # AUDIT LOGS  (audit_api.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "AUDIT",
                "name": "📜 Audit Logs",
                "features": [
                    {
                        "id": "audit",
                        "name": "View Audit Logs",
                        "description": "GET /audit — view paginated system-wide audit log",
                        "min_role": "admin",
                        "method": "GET"
                    },
                    {
                        "id": "audit_stats",
                        "name": "Audit Statistics",
                        "description": "GET /audit/stats — audit log statistics and summaries",
                        "min_role": "admin",
                        "method": "GET"
                    },
                    {
                        "id": "audit_export",
                        "name": "Archived Logs",
                        "description": "GET /audit/archived — retrieve archived audit log entries",
                        "min_role": "admin",
                        "method": "GET"
                    },
                    {
                        "id": "audit_purge",
                        "name": "Purge Audit Logs",
                        "description": "POST /audit/purge — permanently purge old audit log records",
                        "min_role": "super_admin",
                        "method": "POST"
                    },
                ]
            },

            # ──────────────────────────────────────────────────────────────────────
            # INTERNAL / DEV TOOLS  (latent_stream.py)
            # ──────────────────────────────────────────────────────────────────────
            {
                "id": "INTERNAL",
                "name": "🔧 Internal / Dev Tools",
                "features": [
                    {
                        "id": "test_emit",
                        "name": "Test Emit (Dev)",
                        "description": "POST /api/test-emit/{node} — internal test event emit (dev only)",
                        "min_role": "admin",
                        "method": "POST"
                    },
                ]
            },
        ]
    }


@router.patch("/users/{email}/role")
async def update_user_role(email: str, role_data: Dict[str, Any], _user: dict = Depends(require_role("admin"))):
    """Update a user's role.

    Supports both system roles (viewer/editor/analyst/admin/super_admin)
    AND custom roles created in the Role Factory.

    Privilege escalation guard: for system roles, a caller may only assign roles
    strictly below their own level. Custom roles are treated as level 1 (safe)
    unless they have an explicit level set in the roles table.
    """
    from app.services.rbac_service import ROLE_HIERARCHY, _EFFECTIVE_LEVEL

    role = role_data.get("role")
    if not role:
        raise HTTPException(status_code=400, detail="Role name is required")

    caller_role  = _user.get("role", "viewer")
    caller_level = _EFFECTIVE_LEVEL.get(caller_role, 0)

    # --- Resolve target role level (system or custom) ---
    target_level = ROLE_HIERARCHY.get(role.lower(), None)

    conn_id, manual_conn = await get_admin_db_conn()

    if target_level is None:
        # Not a system role — look it up in the roles table (reuse main connection)
        try:
            check_sql = "SELECT level FROM roles WHERE LOWER(name) = LOWER($1)"
            if conn_id:
                res = await db_connector.query(conn_id, check_sql, role)
                row_check = res[0] if res else None
            else:
                row_check = await manual_conn.fetchrow(check_sql, role)

            if row_check is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown role: '{role}'. Create it in the Role Factory first."
                )
            # Custom roles default to level 1 unless explicitly set higher in the DB
            target_level = row_check["level"] or 1
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Could not verify custom role level from DB: %s — treating as safe (level 1)", e)
            target_level = 1   # fail-open: allow assigning unknown custom roles

    # --- Privilege escalation guard ---
    super_admin_level = ROLE_HIERARCHY.get("super_admin", 5)
    if caller_level >= super_admin_level:
        allowed = target_level <= caller_level
    else:
        allowed = target_level < caller_level

    if not allowed:
        if manual_conn:
            await manual_conn.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"You cannot assign the '{role}' role. "
                f"You may only assign roles strictly below your own level ('{caller_role}')."
            ),
        )
    # --- End privilege escalation guard ---
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
            
        # Update Redis cache so the role change is immediate
        try:
            from app.services.redis_client import get_redis
            redis = await get_redis()
            if redis:
                await redis.setex(f"user_role:{email}", 86400, role)  # Cache for 24h
        except Exception as e:
            logger.warning(f"Failed to cache new role for {email}: {e}")
            
        # Log role change
        await audit_logger.log(AuditEvent(
            event_type=AuditEventType.USER_ROLE_CHANGED,
            user_id=_user.get("sub"),
            role=_user.get("role"),
            resource_type="user",
            resource_id=email,
            metadata={"old_role": old_role, "new_role": role}
        ))

        # Fetch updated permissions for this role to include in the WS push
        from app.services.rbac_service import _fetch_role_permissions, invalidate_permissions_cache
        await invalidate_permissions_cache(role)
        fresh_permissions = await _fetch_role_permissions(role)

        # Real-time push: notify the target user's open browser sessions immediately
        import asyncio
        asyncio.create_task(broadcast_role_change(email, role, fresh_permissions))

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