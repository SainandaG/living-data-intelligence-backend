from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from app.services.chat_service import chat_service
from app.services.rbac_service import require_role
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    connection_id: str
    message: str
    history: List[ChatMessage] = []

@router.post("/chat")
async def chat_endpoint(request: ChatRequest, _user: dict = Depends(require_role("analyst"))):
    """
    Chat with the AI Data Analyst about your database.
    """
    try:
        result = await chat_service.generate_response(
            request.message, 
            request.connection_id,
            [h.dict() for h in request.history]
        )
        return result
    except Exception as e:
        logger.error(f"Chat failed for {request.connection_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="AI chat service error")
