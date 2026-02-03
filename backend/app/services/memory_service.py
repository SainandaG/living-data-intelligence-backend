import json
import os
from datetime import datetime
from typing import Dict, List, Any

class MemoryService:
    """
    Long-term Memory & Outcome Learning
    Stores the results of transitions and simulated interventions.
    """
    
    def __init__(self, storage_path: str = "memory_records.json"):
        self.storage_path = storage_path
        self.memory_bank: List[Dict[str, Any]] = []
        self._load_memory()
        
    def record_outcome(self, node_id: str, action: str, initial_coords: Dict[str, float], actual_coords: Dict[str, float]):
        """
        Save the actual outcome of an intervention or drift.
        """
        record = {
            'timestamp': datetime.now().isoformat(),
            'node_id': node_id,
            'action': action,
            'initial_state': initial_coords,
            'actual_state': actual_coords,
            'success_metric': initial_coords['latent_y'] - actual_coords['latent_y']
        }
        
        self.memory_bank.append(record)
        if len(self.memory_bank) > 1000: self.memory_bank.pop(0)
        self._save_memory()

    def get_action_effectiveness(self, action: str) -> float:
        """
        Calculate the average risk reduction for a specific action.
        """
        outcomes = [m['success_metric'] for m in self.memory_bank if m['action'] == action]
        if not outcomes: return 0.0
        return sum(outcomes) / len(outcomes)

    def _load_memory(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r') as f:
                    self.memory_bank = json.load(f)
            except: self.memory_bank = []

    def _save_memory(self):
        try:
            with open(self.storage_path, 'w') as f:
                json.dump(self.memory_bank, f)
        except: pass

# Global instance
memory_service = MemoryService()
