from fastapi import APIRouter, HTTPException
from app.services.ontology_service import ontology_service
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

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
        logger.error(f"Failed to fetch ontology for {connection_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch connection ontology")
