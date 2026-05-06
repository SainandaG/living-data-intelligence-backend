from fastapi import APIRouter, HTTPException, Depends
from app.services.db_connector import db_connector
from app.services.rbac_service import require_role
import logging
from app.services.masking_engine import load_policies, mask_row, apply_mask

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/data/sample/{table_name}/{column_name}")
async def get_sample_data(table_name: str, column_name: str, connection_id: str = None, _user: dict = Depends(require_role("viewer"))):
    """Fetch sample records from a table for gravity visualization"""
    try:
        # If no connection_id provided, pick the last active one
        if not connection_id:
            connections = db_connector.list_connections()
            if not connections:
                raise HTTPException(status_code=400, detail="No active database connection")
            connection_id = connections[0]['id']

        # Construct query to get top 200 records
        safe_table = db_connector.validate_identifier(table_name)
        sql = f"SELECT * FROM {safe_table} LIMIT 200"
        
        # Execute query
        data = await db_connector.query(connection_id, sql)
        
        # Apply masking
        user_role = _user.get("role", "viewer")
        tenant_id = _user.get("tenant_id", "default")
        policies = await load_policies(connection_id or "default", tenant_id)
        if policies:
            data = [mask_row(row, table_name, policies, user_role) for row in data]
            
        return {
            "success": True,
            "table": table_name,
            "gravity_column": column_name,
            "data": data,
            "count": len(data)
        }
    except Exception as e:
        logger.error(f"Sample data fetch failed for {table_name}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch sample data")


@router.get("/data/distinct/{table_name}/{column_name}")
async def get_distinct_values(table_name: str, column_name: str, connection_id: str = None, _user: dict = Depends(require_role("viewer"))):
    """Fetch distinct categorical values from a column (e.g. Regions, Categories)"""
    try:
        if not connection_id:
            connections = db_connector.list_connections()
            if not connections:
                raise HTTPException(status_code=400, detail="No active database connection")
            connection_id = connections[0]['id']

        # Construct query to get top 100 distinct values
        # We use a subquery to avoid performance issues on huge tables
        safe_table = db_connector.validate_identifier(table_name)
        safe_col = db_connector.validate_identifier(column_name)
        sql = f"SELECT DISTINCT {safe_col} FROM {safe_table} WHERE {safe_col} IS NOT NULL LIMIT 100"
        
        # Execute query
        data = await db_connector.query(connection_id, sql)
        
        # Flatten into a list of strings/values
        values = [row[column_name] for row in data if column_name in row]
        
        # Apply masking
        user_role = _user.get("role", "viewer")
        tenant_id = _user.get("tenant_id", "default")
        policies = await load_policies(connection_id or "default", tenant_id)
        if policies:
            policy_key = f"{table_name}.{column_name}"
            if policy_key in policies:
                policy = policies[policy_key]
                from app.services.rbac_service import ROLE_HIERARCHY
                if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(policy["min_role"], 0):
                    values = [apply_mask(v, policy["mask_strategy"]) for v in values]

        return {
            "success": True,
            "table": table_name,
            "column": column_name,
            "values": values,
            "count": len(values)
        }
    except Exception as e:
        logger.error(f"Distinct values fetch failed for {table_name}.{column_name}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch distinct values")

