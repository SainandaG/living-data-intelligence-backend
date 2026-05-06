import os
import logging
import asyncpg
import json
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from datetime import datetime, timedelta

from app.services.rbac_service import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])

async def get_db_conn():
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", 5432))
    db_user = os.getenv("DB_USER")
    db_pass = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME", "wezu_backend")
    
    if not db_user:
        logger.error("DB_USER is not configured")
        raise HTTPException(status_code=500, detail="Database configuration missing")
    
    try:
        return await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_pass,
            database=db_name,
            ssl='require' if 'neon.tech' in db_host else None
        )
    except Exception as e:
        logger.error(f"Failed to connect to primary DB: {e}")
        raise HTTPException(status_code=503, detail="Primary database unavailable")

def _map_event_to_action(event_type: str) -> str:
    if not event_type:
        return "READ"
    event_type = event_type.lower()
    if "create" in event_type or "start" in event_type or "setup" in event_type:
        return "INSERT"
    if "update" in event_type or "approve" in event_type or "reject" in event_type or "step" in event_type:
        return "UPDATE"
    if "delete" in event_type or "remove" in event_type or "fail" in event_type:
        return "DELETE"
    return "READ"

def _map_event_to_module(event_type: str) -> str:
    if not event_type:
        return "other"
    event_type = event_type.lower()
    if event_type.startswith("data.") or event_type.startswith("schema."):
        return "data"
    if event_type.startswith("ml.") or event_type.startswith("model."):
        return "ml"
    if event_type.startswith("agent."):
        return "agent"
    if event_type.startswith("decision.") or event_type.startswith("action."):
        return "decisions"
    return "other"

@router.get("")
async def get_audit_logs(
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    module: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    _user: dict = Depends(require_role("admin"))
):
    conn = await get_db_conn()
    try:
        query_conditions = ["archived = false"]
        params = []
        param_idx = 1
        
        if user_id:
            query_conditions.append(f"user_id ILIKE ${param_idx}")
            params.append(f"%{user_id}%")
            param_idx += 1
            
        if date_from:
            query_conditions.append(f"created_at >= ${param_idx}")
            params.append(datetime.fromisoformat(date_from.replace('Z', '+00:00')))
            param_idx += 1
            
        if date_to:
            query_conditions.append(f"created_at <= ${param_idx}")
            params.append(datetime.fromisoformat(date_to.replace('Z', '+00:00')))
            param_idx += 1

        # Build base query
        where_clause = " AND ".join(query_conditions)
        
        # We fetch rows and filter by action/module in Python since they are computed from event_type
        # Alternatively, we could do SQL LIKE for module
        if module and module.lower() != "all":
            mod = module.lower()
            if mod == "data":
                query_conditions.append(f"(event_type LIKE 'data.%' OR event_type LIKE 'schema.%')")
            elif mod == "ml":
                query_conditions.append(f"(event_type LIKE 'ml.%' OR event_type LIKE 'model.%')")
            elif mod == "agent":
                query_conditions.append(f"event_type LIKE 'agent.%'")
            elif mod == "decisions":
                query_conditions.append(f"(event_type LIKE 'decision.%' OR event_type LIKE 'action.%')")
                
        where_clause = " AND ".join(query_conditions)
        
        count_query = f"SELECT COUNT(*) FROM audit_log WHERE {where_clause}"
        total = await conn.fetchval(count_query, *params)
        
        offset = (page - 1) * limit
        data_query = f"""
            SELECT id, event_type, user_id, role, session_id, tenant_id, resource_id, metadata, created_at
            FROM audit_log
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params.extend([limit, offset])
        
        rows = await conn.fetch(data_query, *params)
        
        items = []
        for r in rows:
            event_type = r['event_type']
            action_type = _map_event_to_action(event_type)
            
            # Post-DB filter for action if needed
            if action and action.upper() != "ALL" and action.upper() != action_type:
                continue
                
            items.append({
                "id": r['id'],
                "timestamp": r['created_at'].isoformat(),
                "user": r['user_id'] or "System",
                "role": r['role'] or "N/A",
                "action": action_type,
                "module": _map_event_to_module(event_type).capitalize(),
                "record_id": r['resource_id'],
                "details": json.loads(r['metadata']) if isinstance(r['metadata'], str) else r['metadata']
            })

        # Calculate pages
        pages = (total + limit - 1) // limit

        return {
            "items": items,
            "total": total,
            "page": page,
            "pages": pages
        }
    except Exception as e:
        logger.error(f"Error fetching audit logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch audit logs")
    finally:
        await conn.close()

@router.get("/stats")
async def get_audit_stats(_user: dict = Depends(require_role("admin"))):
    conn = await get_db_conn()
    try:
        # Get total logs
        total_logs = await conn.fetchval("SELECT COUNT(*) FROM audit_log")
        
        # Getting logs expiring in 7 days assumes a 90 day retention policy
        # So created_at < NOW() - 83 days
        expiring_query = "SELECT COUNT(*) FROM audit_log WHERE created_at < NOW() - INTERVAL '83 days'"
        expiring_count = await conn.fetchval(expiring_query)
        
        # Logs this week
        this_week_query = "SELECT COUNT(*) FROM audit_log WHERE created_at >= NOW() - INTERVAL '7 days'"
        logs_this_week = await conn.fetchval(this_week_query)
        
        # We can group by event_type and then bucket in python
        rows = await conn.fetch("SELECT event_type, COUNT(*) as count FROM audit_log GROUP BY event_type")
        
        logs_by_action = {"INSERT": 0, "UPDATE": 0, "DELETE": 0, "READ": 0}
        logs_by_module = {"data": 0, "ml": 0, "agent": 0, "decisions": 0, "other": 0}
        
        for r in rows:
            et = r['event_type']
            cnt = r['count']
            
            action = _map_event_to_action(et)
            logs_by_action[action] += cnt
            
            mod = _map_event_to_module(et)
            logs_by_module[mod] += cnt

        return {
            "total_logs": total_logs,
            "expiring_in_7_days": expiring_count,
            "logs_this_week": logs_this_week,
            "logs_by_action": logs_by_action,
            "logs_by_module": logs_by_module
        }
    except Exception as e:
        logger.error(f"Error fetching audit stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch audit stats")
    finally:
        await conn.close()

@router.post("/purge")
async def purge_audit_logs(_user: dict = Depends(require_role("super_admin"))):
    conn = await get_db_conn()
    try:
        # Instead of DELETE, we UPDATE archived to true
        query = "UPDATE audit_log SET archived = true WHERE created_at < NOW() - INTERVAL '90 days' AND archived = false"
        result = await conn.execute(query)
        # result is a string like 'UPDATE 5'
        archived_count = int(result.split(" ")[1]) if result.startswith("UPDATE") else 0
        
        purged_before = datetime.utcnow() - timedelta(days=90)
        
        return {
            "archived_count": archived_count,
            "purged_before": purged_before.isoformat(),
            "message": "Rows marked as archived instead of physical deletion."
        }
    except Exception as e:
        logger.error(f"Error archiving audit logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to archive audit logs")
    finally:
        await conn.close()

@router.get("/archived")
async def get_archived_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    _user: dict = Depends(require_role("super_admin"))
):
    conn = await get_db_conn()
    try:
        # Standard filter for archived rows
        query_conditions = ["archived = true"]
        params = []
        
        where_clause = " AND ".join(query_conditions)
        
        count_query = f"SELECT COUNT(*) FROM audit_log WHERE {where_clause}"
        total = await conn.fetchval(count_query)
        
        offset = (page - 1) * limit
        data_query = f"""
            SELECT id, event_type, user_id, role, session_id, tenant_id, resource_id, metadata, created_at
            FROM audit_log
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        """
        
        rows = await conn.fetch(data_query, limit, offset)
        
        items = []
        for r in rows:
            event_type = r['event_type']
            items.append({
                "id": r['id'],
                "timestamp": r['created_at'].isoformat(),
                "user": r['user_id'] or "System",
                "role": r['role'] or "N/A",
                "action": _map_event_to_action(event_type),
                "module": _map_event_to_module(event_type).capitalize(),
                "record_id": r['resource_id'],
                "details": json.loads(r['metadata']) if isinstance(r['metadata'], str) else r['metadata']
            })

        pages = (total + limit - 1) // limit

        return {
            "items": items,
            "total": total,
            "page": page,
            "pages": pages
        }
    except Exception as e:
        logger.error(f"Error fetching archived audit logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch archived audit logs")
    finally:
        await conn.close()
