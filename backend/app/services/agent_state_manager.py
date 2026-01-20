"""
Agent State Manager
Manages state for T0 and T1 agents, command history, and audit logging.
"""
from enum import Enum
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime
import json


class T0State(str, Enum):
    """T0 Agent (Intent Brain) States"""
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    DISPATCHING = "dispatching"
    ERROR = "error"


class T1State(str, Enum):
    """T1 Agent (Execution Engine) States"""
    IDLE = "idle"
    EXECUTING = "executing"
    SUCCESS = "success"
    FAILED = "failed"


@dataclass
class CommandLog:
    """Represents a logged voice command."""
    id: str
    text: str
    intent: str
    action: Optional[str]
    parameters: Dict[str, Any]
    confidence: float
    method: str
    t0_state: str
    t1_state: str
    execution_time_ms: Optional[int] = None
    success: bool = False
    error: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)


class AgentStateManager:
    """
    Manages state for both T0 and T1 agents.
    Tracks current states, command history, and provides audit logging.
    """
    
    def __init__(self, max_history: int = 100):
        """
        Initialize the agent state manager.
        
        Args:
            max_history: Maximum number of commands to keep in history
        """
        self.max_history = max_history
        self.t0_state: T0State = T0State.IDLE
        self.t1_state: T1State = T1State.IDLE
        self.command_history: List[CommandLog] = []
        self.current_command: Optional[CommandLog] = None
        self._command_counter = 0
        
        # Listeners for state changes (for WebSocket broadcasting)
        self._state_change_listeners: List[callable] = []
    
    def update_t0_state(self, new_state: T0State) -> None:
        """
        Update T0 agent state.
        
        Args:
            new_state: The new T0 state
        """
        old_state = self.t0_state
        self.t0_state = new_state
        print(f"T0: {old_state} → {new_state}")
        self._notify_state_change('t0', old_state, new_state)
    
    def update_t1_state(self, new_state: T1State) -> None:
        """
        Update T1 agent state.
        
        Args:
            new_state: The new T1 state
        """
        old_state = self.t1_state
        self.t1_state = new_state
        print(f"T1: {old_state} → {new_state}")
        self._notify_state_change('t1', old_state, new_state)
    
    def start_command(
        self,
        text: str,
        intent: str,
        action: Optional[str],
        parameters: Dict[str, Any],
        confidence: float,
        method: str
    ) -> str:
        """
        Start tracking a new command.
        
        Args:
            text: Original voice command text
            intent: Classified intent
            action: Action to execute
            parameters: Extracted parameters
            confidence: Classification confidence
            method: Classification method used
            
        Returns:
            Command ID
        """
        self._command_counter += 1
        command_id = f"cmd_{self._command_counter:06d}"
        
        self.current_command = CommandLog(
            id=command_id,
            text=text,
            intent=intent,
            action=action,
            parameters=parameters,
            confidence=confidence,
            method=method,
            t0_state=self.t0_state.value,
            t1_state=self.t1_state.value
        )
        
        return command_id
    
    def complete_command(
        self,
        command_id: str,
        success: bool,
        execution_time_ms: int,
        error: Optional[str] = None
    ) -> None:
        """
        Complete the current command and add to history.
        
        Args:
            command_id: The command ID
            success: Whether execution was successful
            execution_time_ms: Execution time in milliseconds
            error: Error message if failed
        """
        if not self.current_command or self.current_command.id != command_id:
            print(f"⚠️ Command {command_id} not found or already completed")
            return
        
        self.current_command.success = success
        self.current_command.execution_time_ms = execution_time_ms
        self.current_command.error = error
        
        # Add to history
        self.command_history.append(self.current_command)
        
        # Trim history if needed
        if len(self.command_history) > self.max_history:
            self.command_history = self.command_history[-self.max_history:]
        
        # Clear current command
        self.current_command = None
    
    def get_current_state(self) -> Dict[str, Any]:
        """
        Get the current state of both agents.
        
        Returns:
            Dictionary with current state information
        """
        try:
            current_cmd_data = None
            if self.current_command:
                try:
                    current_cmd_data = self.current_command.to_dict()
                except Exception as e:
                    print(f"⚠️ Error serializing current command: {e}")
            
            return {
                't0_state': self.t0_state.value if hasattr(self.t0_state, 'value') else str(self.t0_state),
                't1_state': self.t1_state.value if hasattr(self.t1_state, 'value') else str(self.t1_state),
                'current_command': current_cmd_data,
                'total_commands': len(self.command_history),
                'success_rate': self._calculate_success_rate()
            }
        except Exception as e:
            print(f"❌ Critical error in get_current_state: {e}")
            # Minimum viable state fallback
            return {
                't0_state': 'error',
                't1_state': 'idle',
                'current_command': None,
                'total_commands': 0,
                'success_rate': 0.0,
                'error': str(e)
            }
    
    def get_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get command history.
        
        Args:
            limit: Maximum number of recent commands to return
            
        Returns:
            List of command log dictionaries
        """
        recent = self.command_history[-limit:]
        return [cmd.to_dict() for cmd in reversed(recent)]
    
    def get_command(self, command_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific command by ID.
        
        Args:
            command_id: The command ID
            
        Returns:
            Command log dictionary or None
        """
        for cmd in self.command_history:
            if cmd.id == command_id:
                return cmd.to_dict()
        
        if self.current_command and self.current_command.id == command_id:
            return self.current_command.to_dict()
        
        return None
    
    def _calculate_success_rate(self) -> float:
        """Calculate overall success rate from history."""
        if not self.command_history:
            return 1.0
        
        successful = sum(1 for cmd in self.command_history if cmd.success)
        return successful / len(self.command_history)
    
    def add_state_change_listener(self, callback: callable) -> None:
        """
        Add a listener for state changes (for WebSocket broadcasting).
        
        Args:
            callback: Function to call on state change
        """
        self._state_change_listeners.append(callback)
    
    def _notify_state_change(self, agent: str, old_state: str, new_state: str) -> None:
        """Notify all listeners of a state change."""
        for listener in self._state_change_listeners:
            try:
                listener({
                    'agent': agent,
                    'old_state': old_state,
                    'new_state': new_state,
                    'timestamp': datetime.utcnow().isoformat()
                })
            except Exception as e:
                print(f"⚠️ State change listener error: {e}")
    
    def reset(self) -> None:
        """Reset agent states to IDLE."""
        self.update_t0_state(T0State.IDLE)
        self.update_t1_state(T1State.IDLE)
        self.current_command = None
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get overall statistics about agent performance.
        
        Returns:
            Dictionary with statistics
        """
        if not self.command_history:
            return {
                'total_commands': 0,
                'success_rate': 1.0,
                'average_execution_time_ms': 0,
                'intents_breakdown': {},
                'methods_breakdown': {}
            }
        
        total = len(self.command_history)
        successful = sum(1 for cmd in self.command_history if cmd.success)
        
        # Calculate average execution time
        exec_times = [cmd.execution_time_ms for cmd in self.command_history if cmd.execution_time_ms]
        avg_exec_time = sum(exec_times) / len(exec_times) if exec_times else 0
        
        # Intent breakdown
        intents = {}
        for cmd in self.command_history:
            intents[cmd.intent] = intents.get(cmd.intent, 0) + 1
        
        # Method breakdown
        methods = {}
        for cmd in self.command_history:
            methods[cmd.method] = methods.get(cmd.method, 0) + 1
        
        return {
            'total_commands': total,
            'successful_commands': successful,
            'failed_commands': total - successful,
            'success_rate': successful / total,
            'average_execution_time_ms': round(avg_exec_time, 2),
            'intents_breakdown': intents,
            'methods_breakdown': methods
        }
    
    def export_history(self, filepath: str) -> None:
        """
        Export command history to JSON file.
        
        Args:
            filepath: Path to save the JSON file
        """
        data = {
            'exported_at': datetime.utcnow().isoformat(),
            'total_commands': len(self.command_history),
            'statistics': self.get_statistics(),
            'history': [cmd.to_dict() for cmd in self.command_history]
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        
        print(f"✅ Exported {len(self.command_history)} commands to {filepath}")


# Global instance
_state_manager_instance: Optional[AgentStateManager] = None


def get_agent_state_manager() -> AgentStateManager:
    """
    Get the global agent state manager instance (Singleton pattern).
    
    Returns:
        AgentStateManager instance
    """
    global _state_manager_instance
    if _state_manager_instance is None:
        _state_manager_instance = AgentStateManager()
    return _state_manager_instance
