from fastapi import APIRouter, HTTPException
from app.services.hierarchical_flow import hierarchical_flow_service

router = APIRouter()

@router.get("/hierarchy/{connection_id}/table/{table_name}")
async def get_table_hierarchy(connection_id: str, table_name: str):
    """Get hierarchical circle packing structure for a table"""
    result = await hierarchical_flow_service.get_table_hierarchy(connection_id, table_name)
    
    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])
    
    return result

@router.get("/hierarchy/{connection_id}/table/{table_name}/flow")
async def get_historical_flow(connection_id: str, table_name: str, hours: int = 24):
    """Get historical flow data with timestamps"""
    result = await hierarchical_flow_service.get_historical_flow(connection_id, table_name, hours)
    
    return {
        'table': table_name,
        'hours': hours,
        'flow_data': result
    }

@router.get("/hierarchy/{connection_id}/table/{table_name}/animate/{timestamp}")
async def get_flow_animation(connection_id: str, table_name: str, timestamp: str):
    """Get flow animation data for a specific timestamp"""
    result = await hierarchical_flow_service.get_flow_animation_data(connection_id, table_name, timestamp)
    
    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])
    
    return result
