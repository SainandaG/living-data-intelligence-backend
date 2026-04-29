"""
Explainability API - Path Tracing & NLP Explanations
Connects to backend/explainability/path_tracer.py
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import logging

from app.services.rbac_service import require_role

logger = logging.getLogger(__name__)

# Import the orphaned explainability engine
try:
    try:
        from explainability.path_tracer import PathTracer
    except ImportError:
        from backend.explainability.path_tracer import PathTracer
    EXPLAINABILITY_AVAILABLE = True
except ImportError:
    EXPLAINABILITY_AVAILABLE = False
    logger.warning("⚠️ Warning: PathTracer not available")

from ..config.feature_flags import USE_ADVANCED_EXPLAINABILITY

router = APIRouter(prefix="/api/explainability", tags=["explainability"])

# Request/Response models
class ExplainRequest(BaseModel):
    action_id: str
    node_id: Optional[str] = None
    max_paths: int = 3

class ExplainResponse(BaseModel):
    action_id: str
    explanation: str
    paths: List[List[str]]
    influence_scores: Dict[str, float]
    confidence: float

# Initialize tracer if available
_tracer = None
if EXPLAINABILITY_AVAILABLE and USE_ADVANCED_EXPLAINABILITY:
    try:
        _tracer = PathTracer()
        logger.info("✅ PathTracer initialized successfully")
    except Exception as e:
        logger.warning(f"⚠️ PathTracer initialization failed: {e}")

@router.post("/explain", response_model=ExplainResponse)
async def explain_decision(request: ExplainRequest, _user: dict = Depends(require_role("analyst"))):
    """
    Explain a decision using path tracing
    
    Example:
        POST /api/explainability/explain
        {
            "action_id": "highlight_patient_table",
            "node_id": "patient_1",
            "max_paths": 3
        }
    """
    if not USE_ADVANCED_EXPLAINABILITY:
        raise HTTPException(
            status_code=503,
            detail="Explainability disabled. Set USE_ADVANCED_EXPLAINABILITY=true"
        )
    
    if not EXPLAINABILITY_AVAILABLE or _tracer is None:
        raise HTTPException(
            status_code=503,
            detail="PathTracer not available. Check backend/explainability/path_tracer.py"
        )
    
    try:
        # Call the orphaned path tracer
        result = _tracer.trace(
            action_id=request.action_id,
            node_id=request.node_id,
            max_paths=request.max_paths
        )
        
        return ExplainResponse(
            action_id=request.action_id,
            explanation=result['explanation'],
            paths=result['paths'],
            influence_scores=result['influence_scores'],
            confidence=result['confidence']
        )
    
    except Exception as e:
        logger.error(f"Explanation failed for {request.action_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Decision explanation failed")

@router.get("/status")
async def explainability_status(_user: dict = Depends(require_role("viewer"))):
    """Check explainability availability"""
    return {
        "available": EXPLAINABILITY_AVAILABLE and _tracer is not None,
        "enabled": USE_ADVANCED_EXPLAINABILITY,
        "status": "ready" if (_tracer is not None) else "not_initialized"
    }

@router.get("/justification/{connection_id}/{table_name}")
async def get_node_justification(connection_id: str, table_name: str, _user: dict = Depends(require_role("viewer"))):
    """
    Get a natural language justification for a node's metrics.
    """
    from app.services.xai_service import xai_service
    try:
        return await xai_service.get_node_justification(connection_id, table_name)
    except Exception as e:
        logger.error(f"Explainability operation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal explainability service error")

@router.post("/trace")
async def get_reasoning_trace(request: Dict[str, Any], _user: dict = Depends(require_role("analyst"))):
    """
    Get a reasoning trace for an agent action.
    """
    from app.services.xai_service import xai_service
    action = request.get("action")
    parameters = request.get("parameters", {})
    if not action:
        raise HTTPException(status_code=400, detail="Missing action field")
    
    try:
        explanation = await xai_service.explain_agent_action(action, parameters)
        return {"action": action, "explanation": explanation}
    except Exception as e:
        logger.error(f"Node justification failure: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal explainability service error")
    
    try:
        explanation = await xai_service.explain_agent_action(action, parameters)
        return {"action": action, "explanation": explanation}
    except Exception as e:
        logger.error(f"Node justification failure: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal explainability service error")
