from typing import Dict, Any, List, Optional
import logging

# Try importing transformers, handle missing deps gracefully
try:
    from transformers import pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

from app.services.intent_classifier import IntentClassifier as IntentClassifierV1
from app.config.feature_flags import USE_NLP_V2

logger = logging.getLogger(__name__)

class IntentClassifierV2:
    """
    Advanced Intent Classifier using Transformer models for zero-shot classification.
    Falls back to V1 heuristic classifier if improved accuracy is not possible or libraries missing.
    """
    
    def __init__(self):
        self.v1 = IntentClassifierV1()
        self.classifier = None
        
        if TRANSFORMERS_AVAILABLE and USE_NLP_V2:
            try:
                # Using a lightweight, fast model for zero-shot classification
                logger.info("Loading Transformer Model for Intent Classification...")
                self.classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
                logger.info("✅ Transformer Model Loaded")
            except Exception as e:
                logger.warning(f"Failed to load Transformer model: {e}")
                self.classifier = None
        else:
            logger.info("Transformer mode disabled or libraries missing. Running in optimized heuristic mode.")

    async def classify(self, text: str, context: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Classify intent using the best available method.
        """
        # 1. Try Transformer if available
        if self.classifier:
            try:
                return await self._classify_transformer(text)
            except Exception as e:
                logger.error(f"Transformer classification failed: {e}")
        
        # 2. Fallback to V1
        return await self.v1.classify(text, context)

    async def _classify_transformer(self, text: str) -> Dict[str, Any]:
        """Use Zero-Shot classification"""
        candidate_labels = [
            "highlight node", "zoom cluster", "start flow", "stop flow",
            "detect anomaly", "cluster data", "show help", "open panel",
            "reset view", "trace lineage"
        ]
        
        result = self.classifier(text, candidate_labels)
        
        top_label = result['labels'][0]
        confidence = result['scores'][0]
        
        # Map natural language labels to technical intents
        intent_map = {
            "highlight node": "graph.highlight",
            "zoom cluster": "graph.zoom_cluster",
            "start flow": "graph.start_flow",
            "stop flow": "graph.stop_flow",
            "detect anomaly": "analytics.anomaly",
            "cluster data": "analytics.cluster",
            "show help": "ui.help",
            "open panel": "ui.open_panel",
            "reset view": "graph.reset_view",
            "trace lineage": "graph.trace_lineage"
        }
        
        intent = intent_map.get(top_label, "unknown")
        entities = self._extract_entities(text)
        
        return {
            "intent": intent,
            "confidence": confidence,
            "parameters": entities,
            "entities": entities, # Redundant but compliant with some UI expectations
            "method": "transformer_zeroshot"
        }

    def _extract_entities(self, text: str) -> Dict[str, Any]:
        """Enhanced entity extraction"""
        entities = {}
        tokens = text.lower().split()
        
        # Heuristic entity extraction (can be improved with NER model)
        # Tables
        tables = ["patient", "doctor", "transaction", "order", "inventory"]
        for t in tables:
            if t in text.lower():
                entities["table_name"] = t
                entities["table"] = t
        
        # Clusters
        if "cluster" in text.lower():
            # Try to grab word before 'cluster'
            try:
                idx = tokens.index("cluster")
                if idx > 0:
                    entities["cluster_name"] = tokens[idx-1]
            except (ValueError, IndexError):
                pass
                
        # Time
        times = ["today", "yesterday", "week", "month"]
        for t in times:
            if t in text.lower():
                entities["time_range"] = t
                
        return entities

# Factory
def get_intent_classifier():
    if USE_NLP_V2:
        return IntentClassifierV2()
    from app.services.intent_classifier import get_intent_classifier as get_v1
    return get_v1()
