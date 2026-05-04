from typing import Dict, Any, List, Optional
import logging
from .intent_classifier_v2 import IntentClassifierV2
from ..services.intent_classifier import IntentClassifier as IntentClassifierV1
from ..config.feature_flags import USE_NLP_V2

logger = logging.getLogger(__name__)

class UnifiedIntentClassifier:
    """
    Single entry point for intent classification.
    Delegates to V1 or V2 based on feature flag with graceful fallback.
    """
    
    def __init__(self):
        self.v1 = IntentClassifierV1()
        self.v2 = None
        self.version = "v1"
        self._initialize()
    
    def _initialize(self):
        """Initialize the appropriate classifier version"""
        if USE_NLP_V2:
            try:
                self.v2 = IntentClassifierV2()
                self.version = "v2"
                logger.info(" Using IntentClassifier V2 (Transformer-based)")
            except Exception as e:
                logger.warning(f" V2 failed to load: {e}, falling back to V1")
                self.v2 = None
                self.version = "v1"
        else:
            self.version = "v1"
            logger.info(" Using IntentClassifier V1 (Rule-based)")
    
    async def classify(self, text: str, context: Optional[List[str]] = None, ui_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Classify intent using the active classifier.
        """
        if self.version == "v2" and self.v2:
            try:
                # V2 classify currently takes less arguments, we adapt it
                result = await self.v2.classify(text, context)
                result['version'] = "v2"
                return result
            except Exception as e:
                logger.error(f"V2 Classification failed, falling back to V1: {e}")
        
        # Fallback to V1
        result = await self.v1.classify(text, context, ui_context)
        result['version'] = "v1"
        return result

    def add_to_history(self, text: str, classification: Dict[str, Any]) -> None:
        """Add classification to history for context"""
        self.v1.add_to_history(text, classification)
        if self.v2 and hasattr(self.v2, 'add_to_history'):
            self.v2.add_to_history(text, classification)

    def get_stats(self) -> Dict[str, Any]:
        """Return statistics about the classifier"""
        return {
            "version": self.version,
            "v2_loaded": self.v2 is not None,
            "feature_flag_v2": USE_NLP_V2
        }

# Global singleton instance
_unified_classifier = None

def get_intent_classifier() -> UnifiedIntentClassifier:
    """Get the global unified classifier instance (Singleton)"""
    global _unified_classifier
    if _unified_classifier is None:
        _unified_classifier = UnifiedIntentClassifier()
    return _unified_classifier

