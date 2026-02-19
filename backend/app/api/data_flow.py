from fastapi import APIRouter, HTTPException
from app.services.data_flow_analyzer import data_flow_analyzer

router = APIRouter()

@router.get("/data-flow/{connection_id}/{table_name}")
async def get_data_flow(connection_id: str, table_name: str):
    "Get AI-analyzed data flow for a specific table"
    try:
        flow_graph = await data_flow_analyzer.analyze_table_flow(connection_id, table_name)
        
        # Check for service-level errors
        if 'error' in flow_graph:
            error_msg = flow_graph['error']
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            raise HTTPException(status_code=400, detail=error_msg)
            
        return flow_graph
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Data Flow API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data-flow/path/{connection_id}/{from_table}/{to_table}")
async def get_flow_path(connection_id: str, from_table: str, to_table: str):
    """Get the data flow path between two tables"""
    try:
        path = await data_flow_analyzer.get_flow_path(connection_id, from_table, to_table)
        return {"path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
