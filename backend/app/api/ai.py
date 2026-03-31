from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from app.services.agent_analyst import agent_analyst
from app.services.rl_optimizer import rl_optimizer
from app.services.graph_optimizer_nx import graph_optimizer_nx
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    query: str
    connection_id: str

class OptimizationRequest(BaseModel):
    connection_id: Optional[str] = None
    active: Optional[bool] = True
    method: Optional[str] = "heuristic"  # "heuristic" or "networkx"

from app.services.chat_service import chat_service

@router.post("/chat")
async def ai_chat(request: ChatRequest):
    try:
        # Use the real AI ChatService
        result = await chat_service.generate_response(request.query, request.connection_id)
        return {"response": result["response"]}
    except Exception as e:
        logger.error(f"AI Chat failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="AI service error")


@router.get("/gravity-suggestions/{connection_id}")
async def get_gravity_suggestions(connection_id: str):
    """Get AI-powered suggestions for gravity recalculation"""
    from app.services.schema_analyzer import schema_analyzer
    from app.services.agent_service import agent_service
    try:
        schema = await schema_analyzer.analyze_schema(connection_id)
        schema_dict = schema.dict() if hasattr(schema, 'dict') else schema.model_dump()
        suggestions = await agent_service.get_gravity_suggestions(schema_dict)
        return {"suggestions": suggestions}
    except Exception as e:
        logger.error(f"Gravity suggestions failure for {connection_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve AI gravity suggestions")

@router.post("/optimize")
async def optimize_system(request: OptimizationRequest):
    """
    Enable or Disable Layout Optimization with choice of clustering method.
    
    Methods:
        - "heuristic": Prefix-based clustering (fast, works with naming conventions)
        - "networkx": Graph theory clustering (accurate, uses actual relationships)
    """
    try:
        clusters = {}
        method_used = request.method or "heuristic"
        
        if request.active and request.connection_id:
            from app.services.schema_analyzer import schema_analyzer
            schema = await schema_analyzer.analyze_schema(request.connection_id)
            # Handle Pydantic v1/v2 compatibility
            schema_dict = schema.dict() if hasattr(schema, 'dict') else schema.model_dump()
            
            # Choose clustering method
            if method_used == "networkx":
                logger.info("Using NetworkX (Graph Theory) clustering for connection %s", request.connection_id)
                clusters = await graph_optimizer_nx.compute_semantic_clusters(schema_dict)
            else:
                logger.info("Using Heuristic (Prefix-based) clustering for connection %s", request.connection_id)
                clusters = await rl_optimizer.compute_semantic_clusters(schema_dict)
            
            # Store clusters for graph coloring
            from app.services.cluster_store import cluster_store
            cluster_store.set_clusters(request.connection_id, clusters, method_used)
        else:
            # Clear clusters when disabling
            from app.services.cluster_store import cluster_store
            cluster_store.clear_clusters(request.connection_id)

        return {
            "status": "success", 
            "mode": "OPTIMIZED" if request.active else "STANDARD",
            "method": method_used,
            "layout_clusters": clusters,
            "cluster_count": len(set(clusters.values())) if clusters else 0
        }
    except Exception as e:
        logger.error(f"System optimization failed: {e}", exc_info=True)
        return {
            "status": "error", 
            "mode": "STANDARD",
            "error": "Internal optimization failure"
        }
