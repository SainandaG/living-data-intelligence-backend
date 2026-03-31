from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from enum import Enum

class AgentStatus(str, Enum):
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    DISPATCHING = "dispatching"
    EXECUTING = "executing"
    ERROR = "error"

class UIState(BaseModel):
    currentView: str
    selectedNode: Optional[str] = None
    availableTables: List[str] = []

class AgentRequest(BaseModel):
    text: str
    connectionId: str
    userId: Optional[str] = None
    timestamp: float
    context: Optional[List[str]] = []
    uiState: Optional[UIState] = None

class AgentResponse(BaseModel):
    success: bool
    commandId: Optional[str] = None
    intent: str
    action: str
    parameters: Dict[str, Any] = {}
    confidence: float
    method: str
    reasoning: Optional[str] = None
    processingTimeMs: int
    error: Optional[str] = None
    suggestions: Optional[List[str]] = []
    alternatives: Optional[List[str]] = []
    version: str = "1.0.0"

class AgentStateUpdate(BaseModel):
    status: AgentStatus
    lastIntent: Optional[str] = None
    activeCommands: List[str] = []
    timestamp: float
