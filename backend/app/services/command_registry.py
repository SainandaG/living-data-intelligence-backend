"""
Command Registry Service
Manages voice command definitions and intent-to-action mappings.
"""
import json
import os
from typing import Dict, List, Optional, Any
from pathlib import Path
import re


class CommandRegistry:
    """
    Central registry for voice commands and intent mappings.
    Loads commands from JSON configuration and provides lookup services.
    """
    
    def __init__(self, config_path: str = "config/commands.json"):
        """
        Initialize the command registry.
        
        Args:
            config_path: Path to the commands JSON configuration file
        """
        self.config_path = config_path
        self.commands: List[Dict[str, Any]] = []
        self.intent_map: Dict[str, Dict[str, Any]] = {}
        self._load_commands()
    
    def _load_commands(self) -> None:
        """Load commands from JSON configuration file."""
        try:
            config_file = Path(self.config_path)
            if not config_file.exists():
                raise FileNotFoundError(f"Commands configuration not found: {self.config_path}")
            
            with open(config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.commands = data.get('commands', [])
                
            # Build intent map for fast lookup
            for cmd in self.commands:
                self.intent_map[cmd['intent']] = cmd
                
            print(f"Loaded {len(self.commands)} commands from registry")
            
        except Exception as e:
            print(f"Error loading command registry: {e}")
            self.commands = []
            self.intent_map = {}
    
    def get_command_by_intent(self, intent: str) -> Optional[Dict[str, Any]]:
        """
        Get command definition by intent name.
        
        Args:
            intent: The intent identifier
            
        Returns:
            Command definition dictionary or None if not found
        """
        return self.intent_map.get(intent)
    
    def get_action_for_intent(self, intent: str) -> Optional[str]:
        """
        Get the action string for a given intent.
        
        Args:
            intent: The intent identifier
            
        Returns:
            Action string (e.g., "graph.highlight") or None
        """
        cmd = self.get_command_by_intent(intent)
        return cmd['action'] if cmd else None
    
    def match_phrase(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Match a text phrase to a command using pattern matching.
        Extracts parameters from the phrase.
        """
        # Clean text: lowercase, remove punctuation except underscores
        text_clean = re.sub(r'[^\w\s]', '', text.lower()).strip()
        
        for cmd in self.commands:
            for phrase_pattern in cmd['phrases']:
                # Clean the pattern words for matching
                # {param_name} becomes a capture group matching one or more words
                pattern = re.escape(phrase_pattern)
                # Unescape the parameters
                pattern = pattern.replace(r'\{', '(?P<').replace(r'\}', r'>[\w\s]+)')
                
                # Allow flexible start/end and spaces
                pattern = rf".*{pattern}.*"
                
                match = re.search(pattern, text_clean)
                if match:
                    # Extract parameters and clean them
                    params = {k: v.strip().replace(' ', '_') for k, v in match.groupdict().items()}
                    
                    return {
                        'intent': cmd['intent'],
                        'action': cmd['action'],
                        'parameters': params,
                        'command_id': cmd['id'],
                        'description': cmd['description']
                    }
        
        return None
    
    def validate_parameters(self, intent: str, parameters: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Validate parameters for a given intent.
        
        Args:
            intent: The intent identifier
            parameters: Dictionary of parameter values
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        cmd = self.get_command_by_intent(intent)
        if not cmd:
            return False, f"Unknown intent: {intent}"
        
        required_params = cmd.get('parameters', {})
        
        for param_name, param_def in required_params.items():
            if param_def.get('required', False):
                if param_name not in parameters or not parameters[param_name]:
                    return False, f"Missing required parameter: {param_name}"
        
        return True, None
    
    def get_all_commands(self) -> List[Dict[str, Any]]:
        """
        Get all command definitions.
        
        Returns:
            List of all command dictionaries
        """
        return self.commands
    
    def get_examples(self) -> List[str]:
        """
        Get all example phrases from all commands.
        
        Returns:
            List of example phrases
        """
        examples = []
        for cmd in self.commands:
            examples.extend(cmd.get('examples', []))
        return examples
    
    def register_command(self, command: Dict[str, Any]) -> bool:
        """
        Dynamically register a new command (runtime).
        
        Args:
            command: Command definition dictionary
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Validate command structure
            required_fields = ['id', 'intent', 'action', 'phrases']
            for field in required_fields:
                if field not in command:
                    raise ValueError(f"Missing required field: {field}")
            
            # Add to commands list
            self.commands.append(command)
            self.intent_map[command['intent']] = command
            
            print(f"✅ Registered new command: {command['id']}")
            return True
            
        except Exception as e:
            print(f"❌ Error registering command: {e}")
            return False
    
    def reload(self) -> None:
        """Reload commands from configuration file."""
        self._load_commands()
    
    def __len__(self) -> int:
        """Return number of registered commands."""
        return len(self.commands)
    
    def __repr__(self) -> str:
        """String representation of the registry."""
        return f"<CommandRegistry: {len(self.commands)} commands loaded>"


# Global instance
_registry_instance: Optional[CommandRegistry] = None


def get_command_registry() -> CommandRegistry:
    """
    Get the global command registry instance (Singleton pattern).
    
    Returns:
        CommandRegistry instance
    """
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = CommandRegistry()
    return _registry_instance
