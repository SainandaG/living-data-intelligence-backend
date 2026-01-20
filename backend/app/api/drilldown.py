from fastapi import APIRouter, HTTPException
from app.services.drill_down import drill_down_service
from app.services.gravity_engine import gravity_engine
from pydantic import BaseModel

router = APIRouter()

class GravityRequest(BaseModel):
    connection_id: str
    table: str
    column: str
    limit: int = 200

@router.get("/drilldown/{connection_id}/table/{table_name}")
async def get_table_records(connection_id: str, table_name: str, limit: int = 100):
    """Get sample records from a table"""
    if table_name.lower() == 'hub':
        return {"columns": [], "rows": [], "total_rows": 0}

    result = await drill_down_service.get_table_sample(connection_id, table_name, limit)
    
    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])
    
    return result

@router.get("/drilldown/{connection_id}/table/{table_name}/record/{record_id}")
async def get_specific_record(connection_id: str, table_name: str, record_id: str):
    """Get a specific record by ID"""
    result = await drill_down_service.get_record_by_id(connection_id, table_name, record_id)
    
    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])
    
    return result

@router.get("/drilldown/{connection_id}/table/{table_name}/search")
async def search_table_records(connection_id: str, table_name: str, column: str, value: str, limit: int = 50):
    """Search for records in a table"""
    result = await drill_down_service.search_table(connection_id, table_name, column, value, limit)
    
    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])
    
    return result

@router.get("/drilldown/clustered-records/{connection_id}/{table_name}/{column}")
async def get_clustered_records(connection_id: str, table_name: str, column: str):
    """Get records clustered in 3D space with classification colors"""
    try:
        result = await drill_down_service.get_clustered_records(connection_id, table_name, column)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/gravity/calculate")
async def calculate_gravity(request: GravityRequest):
    """Calculate Gravity scores for records in a table column"""
    try:
        results = await gravity_engine.calculate_gravity(
            request.connection_id,
            request.table,
            request.column,
            request.limit
        )
        return {"status": "success", "results": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
