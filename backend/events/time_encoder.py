import math
import time
from typing import Dict

class TimeEncoder:
    """
    Encodes timestamps into cyclical features (sin/cos) for ML models.
    """
    
    def encode(self, timestamp: float = None) -> Dict[str, float]:
        """
        Encode a timestamp (or current time) into cyclical features.
        """
        if timestamp is None:
            timestamp = time.time()
            
        struct_time = time.localtime(timestamp)
        
        # Hour of day (0-23) + minute fraction
        hour = struct_time.tm_hour + struct_time.tm_min / 60.0
        
        # Day of week (0-6)
        day = struct_time.tm_wday
        
        return {
            'hour_sin': math.sin(2 * math.pi * hour / 24.0),
            'hour_cos': math.cos(2 * math.pi * hour / 24.0),
            'day_sin': math.sin(2 * math.pi * day / 7.0),
            'day_cos': math.cos(2 * math.pi * day / 7.0)
        }
