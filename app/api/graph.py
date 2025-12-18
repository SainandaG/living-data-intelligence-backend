from fastapi import APIRouter, HTTPException
from app.models.schemas import Graph
from app.services.graph_generator import graph_generator

router = APIRouter()

@router.get("/graph/{connection_id}", response_model=Graph)
async def get_graph(connection_id: str):
    """Generate 3D graph from schema"""
    try:
        graph = await graph_generator.generate_graph(connection_id)
        return graph
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
