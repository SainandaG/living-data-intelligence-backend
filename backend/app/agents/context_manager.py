"""
Context Manager

Builds and maintains conversational context windows for AI agent sessions.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime

class ConversationTurn:
    def __init__(self, role: str, content: str, intent: str = None, entities: Dict = None, result: Any = None):
        self.role = role
        self.content = content
        self.intent = intent
        self.entities = entities or {}
        self.result = result
        self.timestamp = datetime.now()

class EnhancedContextManager:
    """
    Manages multi-turn conversations with entity resolution and state tracking.
    Specification Section: "T0 Agent - Context Manager"
    """
    
    def __init__(self, max_history: int = 10):
        self.conversation_history: List[ConversationTurn] = []
        self.max_history = max_history
        self.active_entities: Dict[str, Any] = {}
        # Stores specific entity types for faster resolution
        self.entity_history: Dict[str, List[str]] = {
            "table": [],
            "column": [],
            "cluster": [],
            "action": []
        }
        self.last_action: Optional[str] = None
        
    def add_turn(self, role: str, content: str, intent: str = None, entities: Dict = None, result: Any = None):
        """Add conversation turn to history and update entity tracking"""
        turn = ConversationTurn(role, content, intent, entities, result)
        self.conversation_history.append(turn)
        
        # Update active entities and entity-specific history
        if entities:
            self.active_entities.update(entities)
            for key, value in entities.items():
                if key in self.entity_history and value:
                    # Avoid duplicates in history, move latest to end
                    if value in self.entity_history[key]:
                        self.entity_history[key].remove(value)
                    self.entity_history[key].append(value)
                    # Limit history size
                    if len(self.entity_history[key]) > 5:
                        self.entity_history[key].pop(0)
        
        if intent:
            self.last_action = intent
            self.entity_history["action"].append(intent)
        
        # Trim history
        if len(self.conversation_history) > self.max_history:
            self.conversation_history.pop(0)

    def resolve_reference(self, text: str) -> Dict[str, Any]:
        """
        Resolve pronouns and references in user input.
        Examples: 
        "highlight it" -> uses last table
        "zoom into that cluster" -> uses last cluster
        "do it again" -> uses last action + entities
        """
        resolved_entities = {}
        text_lower = text.lower()
        
        # 1. Pronoun Detection
        has_pronoun = any(word in text_lower for word in ['that', 'it', 'this', 'same', 'those', 'them'])
        
        if has_pronoun:
            # Determine referring entity type
            if 'table' in text_lower:
                val = self._get_last_of_type("table")
                if val: resolved_entities['table'] = val
            elif 'cluster' in text_lower:
                val = self._get_last_of_type("cluster")
                if val: resolved_entities['cluster'] = val
            elif 'column' in text_lower or 'field' in text_lower:
                val = self._get_last_of_type("column")
                if val: resolved_entities['column'] = val
            else:
                # Generic "it" -> try to find any recent entity, prioritizing tables
                for etype in ["table", "cluster", "column", "node_id"]:
                    val = self._get_last_of_type(etype)
                    if val:
                        resolved_entities[etype] = val
                        break
        
        # 2. Sequential / Comparative ("more", "again", "further")
        if any(word in text_lower for word in ['more', 'again', 'further', 'another', 'repeat']):
            resolved_entities['is_sequential'] = True
            if self.last_action:
                resolved_entities['last_action'] = self.last_action
            # Inherit previous entities for continuity
            for k, v in self.active_entities.items():
                if k not in resolved_entities:
                    resolved_entities[k] = v
        
        # 3. Spatial ("there", "over there")
        if 'there' in text_lower and self.conversation_history:
            # Look for recent node_id in turn results
            for turn in reversed(self.conversation_history):
                if turn.result and isinstance(turn.result, dict):
                    # Check result or parameters for target
                    target = turn.result.get("parameters", {}).get("target") or turn.result.get("parameters", {}).get("table")
                    if target:
                        resolved_entities['table'] = target
                        break
        
        return resolved_entities

    def _get_last_of_type(self, entity_type: str) -> Optional[str]:
        """Helper to get most recent entity of a specific type"""
        if entity_type in self.entity_history and self.entity_history[entity_type]:
            return self.entity_history[entity_type][-1]
        
        # Fallback to active_entities
        if entity_type in self.active_entities:
            return self.active_entities[entity_type]
        
        # Specialized fallbacks
        if entity_type == "table" and "node_id" in self.active_entities:
            return self.active_entities["node_id"]
            
        return None

    def get_context_summary(self) -> str:
        """Generate context summary for LLM prompt"""
        if not self.conversation_history:
            return "No previous conversation."
        
        summary = "Recent conversation:\n"
        # Include last 3 turns
        for i, turn in enumerate(self.conversation_history[-3:]):
            summary += f"{i+1}. {turn.role.capitalize()}: \"{turn.content}\""
            if turn.intent:
                summary += f" [Intent: {turn.intent}]"
            summary += "\n"
        
        summary += f"\nActive entities: {self.active_entities}\n"
        summary += f"Last action: {self.last_action}\n"
        return summary

    def clear_context(self):
        """Reset context state"""
        self.conversation_history = []
        self.active_entities = {}
        self.entity_history = {k: [] for k in self.entity_history}
        self.last_action = None

# Backward compatibility wrapper
class ContextManager(EnhancedContextManager):
    def add_message(self, role: str, content: str):
        self.add_turn(role, content)

    
    def set_active_entity(self, entity_type: str, entity_value: Any):
        self.active_entities[entity_type] = entity_value
        
    def get_context_snapshot(self) -> Dict[str, Any]:
        return {
            "history": [vars(t) for t in self.conversation_history[-5:]],
            "active_entities": self.active_entities,
            "last_intent": self.last_action
        }
