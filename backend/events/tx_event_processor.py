import hashlib
import time
import math
import random
from typing import Dict, Any

class TxEventProcessor:
    """
    Advanced transaction event processor.
    Handles privacy hashing, time encoding, and event sampling.
    """
    
    def __init__(self, sampling_rate: float = 0.1):
        self.sampling_rate = sampling_rate
        
    def process_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a raw event: hash sensitive data, encode time, decide sampling.
        """
        processed = event.copy()
        
        # 1. Privacy Preserving Hashing
        if 'user_id' in processed:
            processed['user_hash'] = self._hash_value(processed['user_id'])
            del processed['user_id']
            
        # 2. Time Encoding (Cyclical)
        timestamp = processed.get('timestamp', time.time())
        processed.update(self._encode_time(timestamp))
        
        # 3. Importance Sampling
        processed['sampled'] = self._should_sample(event)
        
        return processed
        
    def _hash_value(self, value: str) -> str:
        """SHA-256 hashing for privacy"""
        return hashlib.sha256(str(value).encode()).hexdigest()
        
    def _encode_time(self, timestamp: float) -> Dict[str, float]:
        """Encodes time cyclically (sin/cos) for ML models"""
        # Convert to relevant cycles (e.g., hour of day, day of week)
        struct_time = time.localtime(timestamp)
        
        # Hour of day (0-23)
        hour = struct_time.tm_hour + struct_time.tm_min / 60.0
        
        return {
            'time_sin': math.sin(2 * math.pi * hour / 24.0),
            'time_cos': math.cos(2 * math.pi * hour / 24.0)
        }
        
    def _should_sample(self, event: Dict[str, Any]) -> bool:
        """
        Decide whether to keep this event based on importance and sampling rate.
        High value transactions or errors are always kept.
        """
        # Always sample errors or high priority
        if event.get('type') == 'error' or event.get('priority') == 'high':
            return True
            
        # Random sampling for others
        return random.random() < self.sampling_rate
