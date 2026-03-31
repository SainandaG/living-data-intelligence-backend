from fastapi import APIRouter, HTTPException
from app.services.db_connector import db_connector
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/data/sample/{table_name}/{column_name}")
async def get_sample_data(table_name: str, column_name: str, connection_id: str = None):
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
async def get_distinct_values(table_name: str, column_name: str, connection_id: str = None):
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

