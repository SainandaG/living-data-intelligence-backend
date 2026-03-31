from abc import ABC, abstractmethod
from typing import Dict, Any

class ActionHandler(ABC):
    """
    Abstract base class for T1 Agent action handlers.
    Enforces a common interface for modular action processing.
    """
    
    @abstractmethod
    async def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the specific action.
        
        Args:
            action: The specific action key (e.g., 'highlight_node')
            params: Dictionary of parameters for the action
            
        Returns:
            Dict containing execution results
        """
        pass
