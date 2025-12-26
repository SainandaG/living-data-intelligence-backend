from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from app.services.agent_analyst import agent_analyst
from app.services.rl_optimizer import rl_optimizer

router = APIRouter()

class ChatRequest(BaseModel):
    query: str
    connection_id: str

class OptimizationRequest(BaseModel):
    connection_id: Optional[str] = None
    active: Optional[bool] = True

from app.services.chat_service import chat_service

@router.post("/chat")
async def ai_chat(request: ChatRequest):
    try:
        # Use the real AI ChatService
        result = await chat_service.generate_response(request.query, request.connection_id)
        return {"response": result["response"]}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/optimize")
async def optimize_system(request: OptimizationRequest):
    """Enable or Disable RL Layout Optimization"""
    try:
        # In a real system, this would toggle a background flag
        # For now, we just return the confirmation
        return {"status": "success", "mode": "RL_OPTIMIZED" if request.active else "STANDARD"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
