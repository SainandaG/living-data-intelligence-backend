
from fastapi import APIRouter, HTTPException
import logging

try:
    try:
        from backend.app.services.latent_manager import latent_manager
    except ImportError:
        try:
            from app.services.latent_manager import latent_manager
        except ImportError:
            from ..services.latent_manager import latent_manager
except ImportError:
    from app.services.latent_manager import latent_manager

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/latent/projection")
async def get_latent_projection():
    """
    Get the 3D coordinates (x,y,z) of all nodes in the Latent Space.
    Used for the 'Latent View' in the frontend.
    """
    projection = latent_manager.get_projection()
    if not projection:
        # It might be calculating or empty
        return {
            "status": "empty_or_calculating",
            "nodes": {}
        }
    
    return {
        "status": "ready",
        "nodes": projection
    }

@router.get("/latent/similar/{node_id}")
async def find_similar_nodes(node_id: str, k: int = 5):
    """
    Find nodes that are semantically similar to the given node_id.
    """
    if not latent_manager.is_ready:
        raise HTTPException(status_code=503, detail="Latent space not ready yet")
        
    similar_nodes = latent_manager.find_similar_nodes(node_id, top_k=k)
    return {
        "target": node_id,
        "matches": similar_nodes
    }
