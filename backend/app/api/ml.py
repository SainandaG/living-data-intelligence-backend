"""
ML API - Graph Neural Network Endpoints
Connects to backend/ml/graph_neural_core.py
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from pydantic import BaseModel

# Import the GNN that exists but is orphaned
try:
    try:
        from ml.graph_neural_core import GraphNeuralCore
    except ImportError:
        from backend.ml.graph_neural_core import GraphNeuralCore
    GNN_AVAILABLE = True
except ImportError:
    GNN_AVAILABLE = False
    print("⚠️ Warning: GraphNeuralCore not available")

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
        print("✅ GNN initialized successfully")
    except Exception as e:
        print(f"⚠️ GNN initialization failed: {e}")

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
        
        # Call the orphaned GNN code
        importance = _gnn.predict_importance(request.node_id, request.node_type)
        
        elapsed_ms = (time.time() - start) * 1000
        
        return NodePredictionResponse(
            node_id=request.node_id,
            importance=importance,
            inference_time_ms=elapsed_ms,
            method="gnn"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GNN prediction failed: {str(e)}")

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
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/gnn/status")
async def gnn_status():
    """Check GNN availability and status"""
    return {
        "available": GNN_AVAILABLE and _gnn is not None,
        "enabled": USE_GNN_INFERENCE,
        "status": "ready" if (_gnn is not None) else "not_initialized"
    }
