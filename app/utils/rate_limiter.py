import time
from typing import List
from datetime import datetime, timedelta

class RateLimiter:
    """Sliding window rate limiter for API calls"""
    
    def __init__(self, max_calls: int, time_window_seconds: int):
        self.max_calls = max_calls
        self.time_window = time_window_seconds
        self.calls: List[float] = []
    
    def allow(self) -> bool:
        """Check if a call is allowed based on rate limits"""
        now = time.time()
        # Remove calls outside the current window
        self.calls = [c for c in self.calls if now - c < self.time_window]
        
        if len(self.calls) < self.max_calls:
            self.calls.append(now)
            return True
        return False

    def seconds_until_allowed(self) -> float:
        """Calculate wait time until next call is allowed"""
        if not self.calls:
            return 0
        now = time.time()
        oldest_call = self.calls[0]
        wait_time = self.time_window - (now - oldest_call)
        return max(0, wait_time)
