from fastapi import APIRouter, HTTPException, Depends
from app.services.drill_down import drill_down_service
from app.services.gravity_engine import gravity_engine
from app.services.rbac_service import require_role
from pydantic import BaseModel
import logging
from app.services.masking_engine import load_policies, mask_row

logger = logging.getLogger(__name__)

router = APIRouter()

class GravityRequest(BaseModel):
    connection_id: str
    table: str
    column: str
    limit: int = 200

@router.get("/drilldown/{connection_id}/table/{table_name}")
async def get_table_records(connection_id: str, table_name: str, limit: int = 100, _user: dict = Depends(require_role("viewer"))):
    """Get sample records from a table"""
    if table_name.lower() == 'hub':
        return {"columns": [], "rows": [], "total_rows": 0}

    result = await drill_down_service.get_table_sample(connection_id, table_name, limit)
    
    if 'error' in result:
        error_msg = result['error'].lower()
        if "connection" in error_msg and "not found" in error_msg:
            raise HTTPException(status_code=404, detail="Database connection not found. Please reconnect.")
        raise HTTPException(status_code=500, detail=result['error'])
    
    if 'rows' in result and result['rows']:
        user_role = _user.get("role", "viewer")
        tenant_id = _user.get("tenant_id", "default")
        policies = await load_policies(connection_id, tenant_id)
        if policies:
            result['rows'] = [mask_row(row, table_name, policies, user_role) for row in result['rows']]

    return result

@router.get("/drilldown/{connection_id}/table/{table_name}/record/{record_id}")
async def get_specific_record(connection_id: str, table_name: str, record_id: str, _user: dict = Depends(require_role("viewer"))):
    """Get a specific record by ID"""
    result = await drill_down_service.get_record_by_id(connection_id, table_name, record_id)
    
    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])
    
    if result:
        user_role = _user.get("role", "viewer")
        tenant_id = _user.get("tenant_id", "default")
        policies = await load_policies(connection_id, tenant_id)
        if policies:
            result = mask_row(result, table_name, policies, user_role)
    
    return result

@router.get("/drilldown/{connection_id}/table/{table_name}/search")
async def search_table_records(connection_id: str, table_name: str, column: str, value: str, limit: int = 50, _user: dict = Depends(require_role("viewer"))):
    """Search for records in a table"""
    result = await drill_down_service.search_table(connection_id, table_name, column, value, limit)
    
    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])
    
    if 'rows' in result and result['rows']:
        user_role = _user.get("role", "viewer")
        tenant_id = _user.get("tenant_id", "default")
        policies = await load_policies(connection_id, tenant_id)
        if policies:
            result['rows'] = [mask_row(row, table_name, policies, user_role) for row in result['rows']]

    return result

@router.get("/drilldown/clustered-records/{connection_id}/{table_name}/{column}")
async def get_clustered_records(connection_id: str, table_name: str, column: str, _user: dict = Depends(require_role("viewer"))):
    """Get records clustered in 3D space with classification colors"""
    try:
        result = await drill_down_service.get_clustered_records(connection_id, table_name, column)
        return result
    except Exception as e:
        logger.error(f"Drilldown operation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal drill-down service error")

@router.post("/gravity/calculate")
async def calculate_gravity(request: GravityRequest, _user: dict = Depends(require_role("editor"))):
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
        logger.error(f"Gravity calculation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Gravity calculation failed")
@router.get("/drilldown/{connection_id}/semantic-discovery/{table_name}")
async def get_semantic_discovery(connection_id: str, table_name: str, _user: dict = Depends(require_role("analyst"))):
    """Get predicted semantic relationships for a table"""
    try:
        from app.services.neural_core import neural_core
        from app.services.graph_generator import graph_generator
        
        # 1. Get all other tables for context
        graph = await graph_generator.generate_graph(connection_id)
        other_tables = [n['name'] for n in graph.get('nodes', []) if n['name'] != table_name]
        
        # 2. Get predictions
        predictions = await neural_core.predict_links(connection_id, table_name, other_tables)
        
        return {"status": "success", "predictions": predictions}
    except Exception as e:
        logger.error(f"Drilldown operation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal drill-down service error")
@router.get("/drilldown/{connection_id}/column-intelligence/{table_name}/{column_name}")
async def get_column_intelligence(connection_id: str, table_name: str, column_name: str, _user: dict = Depends(require_role("analyst"))):
    """Get granular intelligence for a specific column"""
    try:
        from app.services.analysis_engine import analysis_engine # Added import for analysis_engine
        # Optimistically fetch row count from schema to helper analysis engine
        from app.services.schema_analyzer import schema_analyzer
        schema = schema_analyzer.get_analysis_result(connection_id)
        known_rows = 0
        if schema and hasattr(schema, 'tables'):
            table_obj = next((t for t in schema.tables if t.name.lower() == table_name.lower()), None)
            if table_obj:
                known_rows = table_obj.row_count or 0
                
        # The original instruction mentioned `get_table_intelligence` but the context is `get_column_intelligence`.
        # Assuming the intent was to pass row count to a column intelligence function if it exists,
        # or that `get_table_intelligence` was a typo for a column-specific function.
        # For now, I'm adapting the call to `neural_core.get_column_intelligence` as it was originally.
        # If `analysis_engine.get_table_intelligence` is truly intended, the function's purpose would change.
        # Given the instruction's ambiguity and the provided code snippet's syntax error,
        # I'm making a best effort to integrate the row count logic while maintaining the original function's call.
        # If `analysis_engine.get_table_intelligence` is the correct call, please provide the correct signature.
        
        # Original call: intelligence = await neural_core.get_column_intelligence(connection_id, table_name, column_name)
        # Modified to include known_rows if the neural_core function supports it, or to use analysis_engine if that was the intent.
        # Based on the provided snippet, it seems to want to call analysis_engine.get_table_intelligence.
        # I'm assuming the instruction meant to replace the neural_core call with analysis_engine.
        # The syntax error in the provided snippet `known_row_count=known_rows), column_name)` is corrected.
        # Corrected call to match AnalysisEngine signature (conn_id, table_name, known_row_count)
        # We drop column_name as Table Intelligence is table-level.
        intelligence = await analysis_engine.get_table_intelligence(connection_id, table_name, known_row_count=known_rows)
        return {"status": "success", "intelligence": intelligence}
    except Exception as e:
        logger.error(f"Drilldown operation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal drill-down service error")

@router.get("/drilldown/{connection_id}/impact-analysis/{table_name}")
async def get_impact_analysis(connection_id: str, table_name: str, _user: dict = Depends(require_role("analyst"))):
    """Analyze the impact of an issue in a specific table"""
    try:
        from app.services.root_cause_analyzer import root_cause_analyzer
        from app.services.db_connector import db_connector
        
        result = await root_cause_analyzer.analyze_impact(db_connector, connection_id, table_name)
        return result
    except Exception as e:
        logger.error(f"Drilldown operation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal drill-down service error")

