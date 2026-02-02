from typing import Dict, Any, Optional
from enum import Enum
import logging

# Wraps existing T0Agent (Adapter Pattern)
from app.services.t0_agent import T0Agent as T0AgentV1
from app.config.feature_flags import USE_ENHANCED_T0_AGENT
from app.services.context_manager import ContextManager

# Configure logger
logger = logging.getLogger(__name__)

class AgentState(Enum):
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    DISPATCHING = "dispatching"
    ERROR = "error"

class T0AgentV2:
    """
    Enhanced T0 Agent with full state machine and context management.
    Wraps legacy T0Agent to ensure backward compatibility.
    """
    
    def __init__(self):
        self.legacy_agent = T0AgentV1()  # Wrap existing
        self.state = AgentState.IDLE
        self.context_manager = ContextManager()
        logger.info(f"T0Agent initialized. Enhanced Mode: {USE_ENHANCED_T0_AGENT}")
    
    async def process_intent(self, text: str, ui_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Enhanced intent processing with context awareness.
        Resolves references (pronouns, etc.) using history before classification.
        """
        if not USE_ENHANCED_T0_AGENT:
            return await self.legacy_agent.process_voice_input(text, ui_context)
        
        self.state = AgentState.PROCESSING
        
        # 1. Resolve References ("zoom in more", "it", "that")
        # In a full v2, we would merge these resolved entities into the input for the classifier
        resolved_context = self.context_manager.resolve_reference(text)
        if resolved_context:
            logger.info(f"Resolved context references: {resolved_context}")
        
        try:
            # 2. Process intent using legacy or v2 classifier
            result = await self.legacy_agent.process_voice_input(text, ui_context)
            
            # 3. Patch parameters with resolved context (Fill in the blanks)
            if result.get("success") and resolved_context:
                params = result.get("parameters", {})
                patched = False
                
                for key, value in resolved_context.items():
                    # If parameter is missing or empty, patch it from context
                    if key not in params or not params[key]:
                        params[key] = value
                        patched = True
                
                if patched:
                    logger.info(f"✨ Patched intent parameters with context: {params}")
                    result["parameters"] = params
            
            # 4. Save full turn to context manager
            self.context_manager.add_turn(
                role="user", 
                content=text,
                intent=result.get("intent"),
                entities=result.get("parameters", {}),
                result=result
            )
            
            self.state = AgentState.IDLE
            return result

            
        except Exception as e:
            self.state = AgentState.ERROR
            logger.error(f"Error in T0AgentV2: {e}")
            return {
                "success": False, 
                "error": str(e),
                "intent": "error",
                "parameters": {}
            }
    
    # Backward compatible methods to match T0Agent interface
    async def process_voice_input(self, text: str, ui_context: Optional[Dict[str, Any]] = None):
        """Maintain exact interface as V1 for drop-in replacement"""
        return await self.process_intent(text, ui_context)

# Factory function for backward compatibility
def get_t0_agent():
    if USE_ENHANCED_T0_AGENT:
        return T0AgentV2()
    else:
        return T0AgentV1()
