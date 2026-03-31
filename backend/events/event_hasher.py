import hashlib

class EventHasher:
    """
    Handles secure hashing of sensitive event fields.
    """
    
    def __init__(self, salt: str = "default_salt"):
        self.salt = salt
        
    def hash_field(self, value: str) -> str:
        """SHA-256 hash with salt"""
        if value is None:
            return None
        return hashlib.sha256((str(value) + self.salt).encode()).hexdigest()
        
    def anonymize_event(self, event: dict, sensitive_fields: list) -> dict:
        """Return a copy of event with sensitive fields hashed"""
        processed = event.copy()
        for field in sensitive_fields:
            if field in processed:
                processed[field] = self.hash_field(processed[field])
        return processed
