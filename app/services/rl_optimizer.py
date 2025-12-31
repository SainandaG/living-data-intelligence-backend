"""
Reinforcement Learning Optimizer
--------------------------------
Self-optimizing system parameters based on user feedback.
"""

import random
from typing import Dict

class RLOptimizer:
    def __init__(self):
        self.q_table = {} # State-Action value table
        self.current_policy = {
            "anomaly_threshold": 0.75,
            "layout_force": 1.0,
            "alert_frequency": "medium"
        }
        self.learning_rate = 0.1
        self.discount_factor = 0.95

    async def suggest_optimization(self, context: Dict) -> Dict:
        """Suggest system parameters based on current context (load, user focus)."""
        if context.get("system_load") == "high":
            self.current_policy["alert_frequency"] = "low"
            return {"action": "reduce_alerts", "reason": "High system load detected"}
        
        return {"action": "maintain", "reason": "Optimal state"}

    async def get_optimized_force(self, node_count: int) -> float:
        """
        Dynamically adjust layout force based on node density and Neural Core gravity.
        """
        from app.services.neural_core import neural_core
        core_metrics = neural_core.get_core_metrics()
        
        base_force = 1.0
        # If too many nodes, increase force to spread them out
        if node_count > 20:
            scale_factor = 1.0 + (node_count - 20) * 0.05
            base_force *= min(scale_factor, 2.5)
        elif node_count < 5:
            base_force = 0.8 # Keep them tighter
            
        # Neural Core "Gravity" pulls things in or pushes them out
        if core_metrics["avg_gravity"] > 2.0:
            base_force *= 0.9 # High gravity pulls nodes closer to the core
            
        self.current_policy["layout_force"] = base_force
        # print(f"🤖 RL Layout Optimizer: Adjusted force to {base_force:.2f} for {node_count} nodes.")
        return base_force

    async def reward_action(self, action: str, reward: float):
        """
        Update learning rate or policy based on rewards.
        """
        print(f"🤖 RL Optimizer: Received reward {reward} for action '{action}'.")
        if reward > 0.8:
            self.learning_rate = min(self.learning_rate * 1.05, 0.5)
        else:
            self.learning_rate = max(self.learning_rate * 0.95, 0.01)

    async def reward_neural_core(self, growth_increment: float):
        """Specific reward for Neural Core evolution events"""
        await self.reward_action("core_growth", growth_increment * 10)

# Global Instance
rl_optimizer = RLOptimizer()
