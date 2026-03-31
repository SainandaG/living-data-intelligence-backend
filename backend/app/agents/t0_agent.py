"""
T0 Agent - Voice Intent Brain
Handles voice input, intent classification, and dispatching to T1.
Consolidated from t0_agent.py + t0_agent_v2.py.
"""
from typing import Dict, Any, Optional
from enum import Enum
import time
import logging

from app.ai.unified_intent_classifier import get_intent_classifier
from app.services.agent_state_manager import get_agent_state_manager, T0State
from app.services.command_registry import get_command_registry
from app.config.feature_flags import USE_ENHANCED_T0_AGENT
from app.services.context_manager import ContextManager

logger = logging.getLogger(__name__)


class T0Agent:
    """
    T0 Agent - The Voice Intent Brain
    
    Responsibilities:
    - Process voice transcription input
    - Classify user intent
    - Maintain conversation context
    - Dispatch to T1 for execution
    - Manage T0 state transitions
    """
    
    def __init__(self):
        """Initialize the T0 Agent."""
        self.intent_classifier = get_intent_classifier()
        self.state_manager = get_agent_state_manager()
        self.command_registry = get_command_registry()
        self.context: list[str] = []
        self.max_context = 5
        # Enhanced V2 features
        self.context_manager = ContextManager()
        self._enhanced = USE_ENHANCED_T0_AGENT
        
        logger.info(f"T0 Agent initialized (Enhanced: {self._enhanced})")
    
    async def process_voice_input(self, text: str, ui_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Process voice transcription and classify intent.
        
        This is the main entry point for the T0 Agent.
        
        Args:
            text: Transcribed voice command text
            
        Returns:
            Processing result with intent, action, and command_id
        """
        start_time = time.time()
        
        # Update state: IDLE → LISTENING
        self.state_manager.update_t0_state(T0State.LISTENING)
        
        try:
            # Update state: LISTENING → PROCESSING
            self.state_manager.update_t0_state(T0State.PROCESSING)
            
            # Classify the intent
            logger.info(f"Processing: '{text}'")
            classification = await self._classify_intent(text, ui_context)
            logger.info(f"Classification ({classification['method']}): {classification['intent']} with params {classification['parameters']}")
            
            # Enhanced V2: Resolve context references before processing
            if self._enhanced:
                resolved_context = self.context_manager.resolve_reference(text)
                if resolved_context:
                    logger.info(f"Resolved context references: {resolved_context}")
                    # Patch parameters with resolved context
                    params = classification.get('parameters', {})
                    for key, value in resolved_context.items():
                        if key not in params or not params[key]:
                            params[key] = value
                    classification['parameters'] = params
            
            # Inject connection_id from UI context if available
            if ui_context and 'connectionId' in ui_context:
                classification['parameters']['connection_id'] = ui_context['connectionId']
            
            # Validate classification
            if classification['intent'] == 'unknown':
                self.state_manager.update_t0_state(T0State.ERROR)
                return {
                    'success': False,
                    'error': 'Could not understand command',
                    'suggestions': classification.get('suggestions', []),
                    'text': text
                }
            
            # Validate parameters
            is_valid, error_msg = self.command_registry.validate_parameters(
                classification['intent'],
                classification['parameters']
            )
            
            if not is_valid:
                self.state_manager.update_t0_state(T0State.ERROR)
                return {
                    'success': False,
                    'error': error_msg,
                    'intent': classification['intent'],
                    'text': text
                }
            
            # Start command tracking
            command_id = self.state_manager.start_command(
                text=text,
                intent=classification['intent'],
                action=classification.get('action'),
                parameters=classification['parameters'],
                confidence=classification['confidence'],
                method=classification['method']
            )
            
            # Add to context
            self._add_to_context(text)
            
            # Add to classifier history
            self.intent_classifier.add_to_history(text, classification)
            
            # Prepare result for T1 dispatch and context
            processing_time = int((time.time() - start_time) * 1000)
            result = {
                'success': True,
                'command_id': command_id,
                'text': text,
                'intent': classification['intent'],
                'action': classification['action'],
                'parameters': classification['parameters'],
                'confidence': classification['confidence'],
                'method': classification['method'],
                'reasoning': classification.get('reasoning'),
                'processing_time_ms': processing_time,
                'alternatives': classification.get('alternatives', [])
            }

            # Enhanced V2: Save to context manager for multi-turn
            if self._enhanced:
                self.context_manager.add_turn(
                    role="user",
                    content=text,
                    intent=classification.get('intent'),
                    entities=classification.get('parameters', {}),
                    result=result
                )
            
            # Update state: PROCESSING → DISPATCHING
            self.state_manager.update_t0_state(T0State.DISPATCHING)
            
            # Back to IDLE after dispatch
            self.state_manager.update_t0_state(T0State.IDLE)
            
            return result
            
        except Exception as e:
            import traceback
            logger.error(f"T0 Agent CRITICAL ERROR: {e}")
            traceback.print_exc()
            self.state_manager.update_t0_state(T0State.ERROR)
            return {
                'success': False,
                'error': str(e),
                'text': text
            }
    
    async def _classify_intent(self, text: str, ui_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Classify user intent using the intent classifier.
        
        Args:
            text: User input text
            ui_context: Current UI context
            
        Returns:
            Classification result
        """
        # Get recent context for better classification
        context = self.context[-3:] if self.context else None
        
        # Classify (this may use LLM, so could be slow)
        classification = await self.intent_classifier.classify(text, context, ui_context)
        
        return classification
    
    def _add_to_context(self, text: str) -> None:
        """
        Add command to conversation context.
        
        Args:
            text: Command text to add
        """
        self.context.append(text)
        if len(self.context) > self.max_context:
            self.context = self.context[-self.max_context:]
    
    def get_context(self) -> list[str]:
        """
        Get current conversation context.
        
        Returns:
            List of recent commands
        """
        return self.context.copy()
    
    def clear_context(self) -> None:
        """Clear conversation context."""
        self.context = []
        self.intent_classifier.history = []
    
    def get_state(self) -> Dict[str, Any]:
        """
        Get current T0 agent state.
        
        Returns:
            State information dictionary
        """
        return {
            'state': self.state_manager.t0_state.value,
            'context_size': len(self.context),
            'recent_context': self.context[-3:] if self.context else []
        }
    
    def get_available_commands(self) -> list[Dict[str, Any]]:
        """
        Get list of available voice commands.
        
        Returns:
            List of command definitions
        """
        return self.command_registry.get_all_commands()
    
    def __repr__(self) -> str:
        return f"<T0Agent state={self.state_manager.t0_state.value}>"


# Global instance
_t0_instance: Optional[T0Agent] = None


def get_t0_agent() -> T0Agent:
    """
    Get the global T0 agent instance (Singleton pattern).
    
    Returns:
        T0Agent instance
    """
    global _t0_instance
    if _t0_instance is None:
        _t0_instance = T0Agent()
    return _t0_instance
