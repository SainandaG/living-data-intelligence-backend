from fastapi import APIRouter, HTTPException
from app.services.db_connector import db_connector
from typing import List, Dict, Any

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
        sql = f"SELECT * FROM {table_name} LIMIT 200"
        
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
        print(f"Error fetching sample data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
        sql = f"SELECT DISTINCT {column_name} FROM {table_name} WHERE {column_name} IS NOT NULL LIMIT 100"
        
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
        print(f"Error fetching distinct values: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

