from fastapi import APIRouter, HTTPException, Depends
from app.services.data_flow_analyzer import data_flow_analyzer
from app.services.rbac_service import require_role
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/data-flow/{connection_id}/{table_name}")
async def get_data_flow(connection_id: str, table_name: str, _user: dict = Depends(require_role("viewer"))):
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
        logger.error(f"Data Flow error for {table_name}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal data flow service error")

@router.get("/data-flow/path/{connection_id}/{from_table}/{to_table}")
async def get_flow_path(connection_id: str, from_table: str, to_table: str, _user: dict = Depends(require_role("viewer"))):
    """Get the data flow path between two tables"""
    try:
        path = await data_flow_analyzer.get_flow_path(connection_id, from_table, to_table)
        return {"path": path}
    except Exception as e:
        logger.error(f"Flow path error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal flow path service error")
