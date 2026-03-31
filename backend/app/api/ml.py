"""
ML API - Graph Neural Network Endpoints
Connects to backend/ml/graph_neural_core.py
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

# Import the GNN that exists but is orphaned
try:
    try:
        from ml.graph_neural_core import GraphNeuralCore
    except ImportError:
        from backend.ml.graph_neural_core import GraphNeuralCore
    GNN_AVAILABLE = True
except ImportError:
    GNN_AVAILABLE = False
    logger.warning("⚠️ Warning: GraphNeuralCore not available")

from ..config.feature_flags import USE_GNN_INFERENCE

router = APIRouter(prefix="/api/ml", tags=["machine-learning"])

# Request/Response models
class NodePredictionRequest(BaseModel):
    node_id: str
    node_type: str = "table"

class NodePredictionResponse(BaseModel):
    node_id: str
    importance: float
    inference_time_ms: float
    method: str

class BatchPredictionRequest(BaseModel):
    nodes: list

# Initialize GNN if available
_gnn = None
if GNN_AVAILABLE and USE_GNN_INFERENCE:
    try:
        _gnn = GraphNeuralCore()
        logger.info("✅ GNN initialized successfully")
    except Exception as e:
        logger.warning(f"⚠️ GNN initialization failed: {e}")

@router.post("/gnn/predict", response_model=NodePredictionResponse)
async def predict_node_importance(request: NodePredictionRequest):
    """
    Predict node importance using Graph Neural Network
    
    Example:
        POST /api/ml/gnn/predict
        {
            "node_id": "patient_1",
            "node_type": "table"
        }
    """
    if not USE_GNN_INFERENCE:
        raise HTTPException(
            status_code=503, 
            detail="GNN inference disabled. Set USE_GNN_INFERENCE=true"
        )
    
    if not GNN_AVAILABLE or _gnn is None:
        raise HTTPException(
            status_code=503,
            detail="GNN not available. Check backend/ml/graph_neural_core.py"
        )
    
    try:
        import time
        start = time.time()
        
        # 1. Fetch Real Context from Neural Core
        # This ensures we don't rely on the mock fallback in graph_neural_core.py
        from ..services.neural_core import neural_core
        from ..services.schema_analyzer import schema_analyzer
        
        conn_id = neural_core.active_connection_id
        node_data = None
        
        if conn_id:
            # Attempt to find real metadata
            schema = schema_analyzer.get_analysis_result(conn_id)
            if schema and schema.tables:
                target_table = next((t for t in schema.tables if t.name == request.node_id), None)
                if target_table:
                    # Construct real data payload
                    node_data = {
                        "id": target_table.name,
                        "type": "table",
                        "record_count": target_table.row_count or 0,
                        # GNN expects a list to calculate degree (len)
                        "edges": target_table.foreign_keys if target_table.foreign_keys else [],
                        "columns": len(target_table.columns) if target_table.columns else 0
                    }
                    logger.info(f"🧠 GNN: Injected real metadata for {request.node_id} (Rows: {node_data['record_count']})")

        # 2. Call GNN with (optional) Real Data
        importance = _gnn.predict_importance(request.node_id, request.node_type, node_data=node_data)
        
        elapsed_ms = (time.time() - start) * 1000
        
        return NodePredictionResponse(
            node_id=request.node_id,
            importance=importance,
            inference_time_ms=elapsed_ms,
            method="gnn_real" if node_data else "gnn_heuristic"
        )
    
    except Exception as e:
        logger.error(f"GNN prediction failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="GNN inference error")

@router.post("/gnn/predict/batch")
async def predict_batch_importance(request: BatchPredictionRequest):
    """
    Batch predict importance for multiple nodes
    
    Example:
        POST /api/ml/gnn/predict/batch
        {
            "nodes": [
                {"node_id": "patient_1", "node_type": "table"},
                {"node_id": "doctor_1", "node_type": "table"}
            ]
        }
    """
    if not USE_GNN_INFERENCE or not GNN_AVAILABLE or _gnn is None:
        raise HTTPException(status_code=503, detail="GNN not available")
    
    try:
        results = []
        for node in request.nodes:
            importance = _gnn.predict_importance(node['node_id'], node.get('node_type', 'table'))
            results.append({
                'node_id': node['node_id'],
                'importance': importance
            })
        
        return {"predictions": results}
    
    except Exception as e:
        logger.error(f"Batch GNN prediction failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="GNN batch inference error")

@router.get("/gnn/status")
async def gnn_status():
    """Check GNN availability and status"""
    return {
        "available": GNN_AVAILABLE and _gnn is not None,
        "enabled": USE_GNN_INFERENCE,
        "status": "ready" if (_gnn is not None) else "not_initialized"
    }
