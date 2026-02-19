from fastapi import APIRouter, HTTPException
from app.services.ontology_service import ontology_service
from typing import Dict, Any

router = APIRouter()

@router.get("/{connection_id}")
async def get_ontology(connection_id: str) -> Dict[str, Any]:
    """
    Fetch the formal semantic ontology for a connection.
    Includes Object types, semantic Properties, and Link predicates.
    """
    try:
        return await ontology_service.get_active_ontology(connection_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch ontology: {str(e)}")
