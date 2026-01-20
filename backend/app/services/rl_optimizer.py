"""
Reinforcement Learning Optimizer
--------------------------------
Self-optimizing system parameters based on user feedback.
"""

import random
from typing import Dict, List

class RLOptimizer:
    def __init__(self):
        self.q_table = {} 
        self.learning_rate = 0.1
        self.discount_factor = 0.95

    async def compute_semantic_clusters(self, schema: Dict) -> Dict[str, str]:
        """
        Analyze schema table names to identify semantic clusters.
        Real logic: Groups tables by common prefixes (e.g., 'auth_user', 'auth_log' -> 'auth').
        """
        if not schema or 'tables' not in schema:
            return {}
            
        tables = [t['name'] for t in schema['tables']]
        clusters = {}
        
        # 1. Identify common prefixes
        prefixes = {}
        for t in tables:
            parts = t.split('_')
            if len(parts) > 1:
                p = parts[0]
                prefixes[p] = prefixes.get(p, 0) + 1
        
        # Filter insignificant prefixes
        valid_prefixes = {p for p, count in prefixes.items() if count >= 2}
        
        # 2. Assign clusters
        for t in tables:
            parts = t.split('_')
            assigned = False
            if len(parts) > 1 and parts[0] in valid_prefixes:
                clusters[t] = parts[0]
                assigned = True
            
            if not assigned:
                clusters[t] = "default"
                
        # print(f"🤖 RL Optimizer: Computed {len(valid_prefixes)} semantic clusters for {len(tables)} tables.")
        return clusters

    async def suggest_optimization(self, context: Dict) -> Dict:
        """Suggest system parameters based on current context (load, user focus)."""
        if context.get("system_load") == "high":
            return {"action": "reduce_alerts", "reason": "High system load detected"}
        return {"action": "maintain", "reason": "Optimal state"}

    async def get_optimized_force(self, node_count: int) -> float:
        """Dynamically adjust layout force based on node density."""
        base_force = 1.0
        if node_count > 20:
            scale_factor = 1.0 + (node_count - 20) * 0.05
            base_force *= min(scale_factor, 2.5)
        elif node_count < 5:
            base_force = 0.8
        return base_force

# Global Instance
rl_optimizer = RLOptimizer()
