import random

class EventSampler:
    """
    Decides whether to keep an event based on importance sampling.
    """
    
    def __init__(self, default_rate: float = 0.1):
        self.default_rate = default_rate
        
    def should_keep(self, event: dict) -> bool:
        """
        Returns True if event should be kept.
        """
        # Always keep errors
        if event.get('level') == 'ERROR' or event.get('type') == 'error':
            return True
            
        # Always keep critical transactions
        if event.get('priority') == 'critical':
            return True
            
        # Sample the rest
        return random.random() < self.default_rate
