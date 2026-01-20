"""
Agent API Endpoints
Provides REST API for T0/T1 voice agent system.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

from app.services.t0_agent import get_t0_agent
from app.services.t1_agent import get_t1_agent
from app.services.agent_state_manager import get_agent_state_manager
from app.services.command_registry import get_command_registry


router = APIRouter(prefix="/api/agent", tags=["agent"])


# ============ REQUEST/RESPONSE MODELS ============

class IntentRequest(BaseModel):
    """Request model for intent processing."""
    text: str = Field(..., description="Voice command text")
    context: Optional[List[str]] = Field(None, description="Recent command context")
    ui_context: Optional[Dict[str, Any]] = Field(None, description="Current UI context (view, table, etc.)")


class IntentResponse(BaseModel):
    """Response model for intent processing."""
    success: bool
    command_id: Optional[str] = None
    text: str
    intent: Optional[str] = None
    action: Optional[str] = None
    parameters: Dict[str, Any] = {}
    confidence: Optional[float] = None
    method: Optional[str] = None
    processing_time_ms: Optional[int] = None
    reasoning: Optional[str] = None
    error: Optional[str] = None
    suggestions: List[str] = []
    alternatives: List[str] = []


class ExecuteRequest(BaseModel):
    """Request model for action execution."""
    command_id: str = Field(..., description="Command ID from intent processing")
    action: str = Field(..., description="Action to execute")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Action parameters")


class ExecuteResponse(BaseModel):
    """Response model for action execution."""
    success: bool
    action: str
    result: Optional[Dict[str, Any]] = None
    execution_time_ms: Optional[int] = None
    error: Optional[str] = None


class StateResponse(BaseModel):
    """Response model for agent state."""
    t0_state: str
    t1_state: str
    current_command: Optional[Dict[str, Any]] = None
    total_commands: int
    success_rate: float


class CommandHistory(BaseModel):
    """Response model for command history."""
    commands: List[Dict[str, Any]]
    total: int
    limit: int


# ============ API ENDPOINTS ============

@router.post("/intent", response_model=IntentResponse)
async def process_intent(request: IntentRequest):

    """
    Process voice command text and classify intent.
    
    This is the entry point for the T0 Agent.
    Returns intent, action, and parameters for execution.
    """
    try:
        t0 = get_t0_agent()
        result = await t0.process_voice_input(request.text, request.ui_context)
        
        return IntentResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute", response_model=ExecuteResponse)
async def execute_action(request: ExecuteRequest):
    """
    Execute a platform action.
    
    This triggers the T1 Agent to perform the requested action.
    """
    try:
        t1 = get_t1_agent()
        result = await t1.execute_action(
            command_id=request.command_id,
            action=request.action,
            parameters=request.parameters
        )
        
        return ExecuteResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state", response_model=StateResponse)
async def get_agent_state():
    """
    Get current state of T0 and T1 agents.
    
    Returns current states, active command, and success metrics.
    """
    try:
        state_manager = get_agent_state_manager()
        state = state_manager.get_current_state()
        return StateResponse(**state)
        
    except Exception as e:
        print(f"❌ [AGENT API] Error fetching state: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch agent state: {str(e)}")


@router.get("/logs", response_model=CommandHistory)
async def get_command_logs(limit: int = 10):
    """
    Get recent command history.
    """
    try:
        state_manager = get_agent_state_manager()
        history = state_manager.get_history(limit=limit)
        
        return CommandHistory(
            commands=history,
            total=len(state_manager.command_history),
            limit=limit
        )
        
    except Exception as e:
        print(f"❌ [AGENT API] Error fetching logs: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch command logs: {str(e)}")


@router.get("/commands")
async def get_available_commands():
    """
    Get list of available voice commands.
    
    Returns all registered commands with their phrases, intents, and parameters.
    """
    try:
        registry = get_command_registry()
        commands = registry.get_all_commands()
        
        return {
            "commands": commands,
            "total": len(commands)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_agent_statistics():
    """
    Get overall agent performance statistics.
    
    Returns success rate, execution times, intent breakdown, etc.
    """
    try:
        state_manager = get_agent_state_manager()
        stats = state_manager.get_statistics()
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/context/clear")
async def clear_context():
    """
    Clear conversation context for T0 agent.
    
    Useful for starting fresh conversations.
    """
    try:
        t0 = get_t0_agent()
        t0.clear_context()
        
        return {"success": True, "message": "Context cleared"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset")
async def reset_agents():
    """
    Reset both T0 and T1 agents to IDLE state.
    
    Useful for error recovery.
    """
    try:
        state_manager = get_agent_state_manager()
        state_manager.reset()
        
        t0 = get_t0_agent()
        t0.clear_context()
        
        return {"success": True, "message": "Agents reset to IDLE"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/command/{command_id}")
async def get_command_details(command_id: str):
    """
    Get details of a specific command by ID.
    
    Args:
        command_id: The command ID
        
    Returns:
        Command details including execution result
    """
    try:
        state_manager = get_agent_state_manager()
        command = state_manager.get_command(command_id)
        
        if not command:
            raise HTTPException(status_code=404, detail=f"Command not found: {command_id}")
        
        return command
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
