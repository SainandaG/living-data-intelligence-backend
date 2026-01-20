"""
Intent Classifier Service
Classifies user voice commands into actionable intents using LLM + rule-based hybrid approach.
"""
import os
import re
from typing import Dict, List, Optional, Any, Tuple
import json

# Import LLM clients
try:
    from groq import AsyncGroq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from app.services.command_registry import get_command_registry


class IntentClassifier:
    """
    Hybrid intent classifier using both rule-based matching and LLM inference.
    Falls back gracefully: Rule-based → Groq → Gemini → Default
    """
    
    def __init__(self):
        """Initialize the intent classifier."""
        self.command_registry = get_command_registry()
        self.groq_client = None
        self.gemini_model = None
        
        # Initialize LLM clients
        self._init_groq()
        self._init_gemini()
        
        # Classification history for context
        self.history: List[Dict[str, Any]] = []
        self.max_history = 5
    
    def _init_groq(self) -> None:
        """Initialize Groq client if API key is available."""
        if not GROQ_AVAILABLE:
            print("[WARNING] Groq library not installed")
            return
            
        api_key = os.getenv('GROQ_API_KEY')
        if api_key:
            try:
                self.groq_client = AsyncGroq(api_key=api_key)
                print("[SUCCESS] Groq LLM (Async) initialized for intent classification")
            except Exception as e:
                print(f"[ERROR] Groq initialization failed: {e}")
        else:
            print("[ERROR] GROQ_API_KEY not found in environment")
    
    def _init_gemini(self) -> None:
        """Initialize Gemini client if API key is available."""
        if not GEMINI_AVAILABLE:
            print("[WARNING] Gemini library not installed")
            return
            
        api_key = os.getenv('GOOGLE_API_KEY')
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.gemini_model = genai.GenerativeModel('gemini-pro')
                print("[SUCCESS] Gemini LLM initialized for intent classification")
            except Exception as e:
                print(f"[WARNING] Gemini initialization failed: {e}")
        else:
            print("[WARNING] GOOGLE_API_KEY not found in environment")
    
    async def classify(self, text: str, context: Optional[List[str]] = None, ui_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Classify user text into an intent with extracted parameters.
        
        Args:
            text: The user's voice command text
            context: Optional list of recent commands for context
            ui_context: Optional current UI context
            
        Returns:
            Classification result with intent, parameters, confidence, and method
        """
        # Step 1: Try rule-based matching first (fast, but non-contextual)
        rule_result = self._classify_rule_based(text)
        if rule_result:
            return {
                **rule_result,
                'confidence': 1.0,
                'method': 'rule_based',
                'reasoning': "Matched pre-defined command pattern.",
                'alternatives': []
            }
        
        # Step 2: Try LLM classification (Groq or Gemini) - Now context-aware
        llm_result = await self._classify_llm(text, context, ui_context)
        if llm_result:
            return llm_result
        
        # Step 3: Fallback to fuzzy matching
        fuzzy_result = self._classify_fuzzy(text)
        if fuzzy_result:
            return fuzzy_result
        
        # Step 4: Unknown / Failed classification
        return {
            'intent': 'unknown',
            'action': None,
            'parameters': {},
            'confidence': 0.0,
            'method': 'failed',
            'error': 'Could not classify command',
            'suggestions': self._get_suggestions(text)
        }
    
    def _classify_rule_based(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Rule-based classification using regex pattern matching.
        
        Args:
            text: User input text
            
        Returns:
            Classification result or None
        """
        result = self.command_registry.match_phrase(text)
        return result
    
    async def _classify_llm(self, text: str, context: Optional[List[str]] = None, ui_context: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """
        LLM-based classification using Groq or Gemini.
        
        Args:
            text: User input text
            context: Recent command context
            ui_context: Current UI context
            
        Returns:
            Classification result or None
        """
        # Try Groq first (faster)
        if self.groq_client:
            try:
                result = await self._classify_groq(text, context, ui_context)
                if result:
                    return result
            except Exception as e:
                print(f"[ERROR] Groq classification failed: {e}")
        
        # Fallback to Gemini
        if self.gemini_model:
            try:
                result = await self._classify_gemini(text, context, ui_context)
                if result:
                    return result
            except Exception as e:
                print(f"[ERROR] Gemini classification failed: {e}")
        
        return None
    
    async def _classify_groq(self, text: str, context: Optional[List[str]] = None, ui_context: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Classify using Groq LLM."""
        if self.groq_client is None:
            return None
        
        prompt = self._build_llm_prompt(text, context, ui_context)
        
        try:
            response = await self.groq_client.chat.completions.create(
                model="llama-3-70b-8192",
                messages=[
                    {"role": "system", "content": "You are an intelligent intent classifier for a database visualization platform. You understand UI context and provide reasoning for your decisions. Respond ONLY with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=300
            )
            
            content = response.choices[0].message.content.strip()
            
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()
            
            result = json.loads(content)
            
            return {
                'intent': result.get('intent', 'unknown'),
                'action': self.command_registry.get_action_for_intent(result.get('intent', '')),
                'parameters': result.get('parameters', {}),
                'confidence': result.get('confidence', 0.7),
                'reasoning': result.get('reasoning', ''),
                'method': 'groq_llm',
                'alternatives': result.get('alternatives', [])
            }
        except Exception as e:
            print(f"[ERROR] Groq classification internal error: {e}")
            return None
    
    async def _classify_gemini(self, text: str, context: Optional[List[str]] = None, ui_context: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Classify using Gemini LLM."""
        if not self.gemini_model:
            return None
        
        prompt = self._build_llm_prompt(text, context, ui_context)
        
        try:
            response = await self.gemini_model.generate_content_async(prompt)
            content = response.text.strip()
            
            # Extract JSON
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()
            
            result = json.loads(content)
            
            return {
                'intent': result.get('intent', 'unknown'),
                'action': self.command_registry.get_action_for_intent(result.get('intent', '')),
                'parameters': result.get('parameters', {}),
                'confidence': result.get('confidence', 0.7),
                'reasoning': result.get('reasoning', ''),
                'method': 'gemini_llm',
                'alternatives': result.get('alternatives', [])
            }
            
        except Exception as e:
            print(f"[ERROR] Gemini classification error: {e}")
            return None
    
    def _build_llm_prompt(self, text: str, context: Optional[List[str]] = None, ui_context: Optional[Dict[str, Any]] = None) -> str:
        """Build the LLM prompt for intent classification."""
        # Get available commands
        commands = self.command_registry.get_all_commands()
        
        command_list = "\n".join([
            f"- {cmd['intent']}: {cmd['description']} (params: {list(cmd.get('parameters', {}).keys())})"
            for cmd in commands
        ])
        
        context_str = ""
        if context:
            context_str = f"\n\nRecent commands:\n" + "\n".join([f"- {c}" for c in context[-3:]])
            
        ui_context_str = ""
        available_tables_str = ""
        system_telemetry_str = ""
        if ui_context:
            ui_context_str = f"\n\nCurrent UI State:\n" + "\n".join([f"- {k}: {v}" for k, v in ui_context.items() if k not in ['availableTables', 'databaseMetrics', 'neuralCoreStats']])
            
            if 'availableTables' in ui_context:
                available_tables_str = f"\n\nACTUAL DATABASE TABLES:\n" + ", ".join(ui_context['availableTables'])
            
            if 'databaseMetrics' in ui_context or 'neuralCoreStats' in ui_context:
                metrics = ui_context.get('databaseMetrics', {})
                stats = ui_context.get('neuralCoreStats', {})
                system_telemetry_str = f"""
SYSTEM TELEMETRY (Real-time):
- Health Score: {metrics.get('health', {}).get('score', 'N/A')}% ({metrics.get('health', {}).get('state', 'Unknown')})
- Anomalies Detected: {len(metrics.get('anomalies', []))}
- Neural Core Growth: {stats.get('gravity', '1.0x')}
- Optimization Status: {stats.get('optimization', 'IDLE')}
- Traffic Load: {metrics.get('tps', 0)} Transactions/sec
"""
        
        prompt = f"""You are a specialized intent classifier for the "Living Data Intelligence" platform.
Your job is to map user natural language into technical intents.

Available Intents and their purposes:
{command_list}{available_tables_str}{system_telemetry_str}

AUTONOMOUS DOMAIN ADAPTATION & PROACTIVE INTELLIGENCE:
1. Analyze the ACTUAL DATABASE TABLES and SYSTEM TELEMETRY listed above.
2. Identify the likely industry or domain of this database (e.g., Healthcare, E-commerce, Finance, Logistics).
3. Act as a proactive specialist in that domain. If a user asks a vague question, map it to the most valuable Intent for that domain.
4. If a user mentions a concept like "audit", "trace", or "track", use the "trace_lineage" intent on the most central table (e.g., 'transactions' or 'orders').
5. DATA SONIFICATION: If the user mentions "listening", "sound", "audio", or "sonify", use the "toggle_sonification" intent. This is a v2.0 feature.
6. NEURAL OPTIMIZATION: If the user mentions "cleanup", "organize", or "optimize", use the "apply_clustering" intent.

Important Logic Rules:
1. NO UNKNOWN POLICY: Avoid returning the "unknown" intent if there is ANY reasonable mapping to an available intent. Use "Domain Mapping" to bridge the gap.
2. STRICT TABLE CONSTRAINT: When using "drill_down", "zoom_cluster", or "trace_lineage", you MUST ONLY use table names from the "ACTUAL DATABASE TABLES" list.
3. NAVIGATION OVER STATUS: If the command includes navigation verbs like "zoom", "go to", "find", or "show me", PRIORITIZE table matching (highlight_node or zoom_cluster).
4. STRICT TABLE VALIDATION: You MUST ONLY use values from the "ACTUAL DATABASE TABLES" list for table parameters. DO NOT hallucinate tables based on the domain (e.g., do not use "dresses" unless it is in the list). If a user mentions a concept not in the table list, map it to the most relevant EXISTENT table or use the "unknown" intent if no mapping is possible.
5. REASONING: Your "reasoning" field should explain how you used the Neural Core (telemetry and tables) to arrive at the decision.

User Command: "{text}"{context_str}{ui_context_str}

Respond with ONLY a JSON object:
{{
  "intent": "intent_name",
  "domain_detected": "The industry/domain you identified",
  "parameters": {{"param_name": "value"}},
  "confidence": 0.95,
  "reasoning": "Mention the domain you detected and why you mapped the command to this intent. E.g., 'Identified Finance domain. User asked for audit logs which I mapped to drill_down transactions.'",
  "alternatives": ["alternative1"]
}}
"""
        return prompt
    
    def _classify_fuzzy(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Fuzzy matching based on keyword overlap.
        
        Args:
            text: User input text
            
        Returns:
            Classification result or None
        """
        text_lower = text.lower()
        words = set(text_lower.split())
        
        best_match = None
        best_score = 0.0
        
        for cmd in self.command_registry.get_all_commands():
            for phrase in cmd['phrases']:
                phrase_words = set(phrase.lower().replace('{', '').replace('}', '').split())
                # Calculate word overlap
                overlap = len(words & phrase_words)
                score = overlap / max(len(words), len(phrase_words))
                
                if score > best_score and score > 0.3:  # 30% minimum overlap
                    best_score = score
                    best_match = cmd
        
        if best_match:
            return {
                'intent': best_match['intent'],
                'action': best_match['action'],
                'parameters': {},  # Can't extract params reliably in fuzzy mode
                'confidence': best_score,
                'method': 'fuzzy_match',
                'note': 'Parameter extraction may be incomplete'
            }
        
        return None
    
    def _get_suggestions(self, text: str) -> List[str]:
        """Get command suggestions based on failed input."""
        examples = self.command_registry.get_examples()
        return examples[:3]  # Return top 3 examples
    
    def add_to_history(self, text: str, classification: Dict[str, Any]) -> None:
        """
        Add a classification to history for context.
        
        Args:
            text: Original user text
            classification: Classification result
        """
        self.history.append({
            'text': text,
            'intent': classification.get('intent'),
            'timestamp': None  # Could add timestamp
        })
        
        # Keep only recent history
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]
    
    def get_context(self) -> List[str]:
        """Get recent commands as context strings."""
        return [h['text'] for h in self.history]


# Global instance
_classifier_instance: Optional[IntentClassifier] = None


def get_intent_classifier() -> IntentClassifier:
    """
    Get the global intent classifier instance (Singleton pattern).
    
    Returns:
        IntentClassifier instance
    """
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = IntentClassifier()
    return _classifier_instance
