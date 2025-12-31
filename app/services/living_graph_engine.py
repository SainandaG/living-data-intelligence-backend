from typing import Dict, List, Optional, Any
from datetime import datetime
import math
import random
from app.models.schemas import Table, GraphNode

class LivingGraphEngine:
    """
    Core engine for the Living Graph system.
    Manages node evolution, health states, and biological behaviors.
    """
    
    def __init__(self):
        self.node_states: Dict[str, Dict] = {}
        self.system_pulse = 0.0
        self.last_update = datetime.now()
        
    def evolve_node(self, node: Any, activity_metrics: Dict) -> Any:
        """
        Evolve a single node based on its recent activity.
        Simulates biological growth, stress, and adaptation.
        """
        # Helper for universal access
        def get(obj, attr, default=None):
            return obj.get(attr, default) if isinstance(obj, dict) else getattr(obj, attr, default)
            
        def set_val(obj, attr, val):
            if isinstance(obj, dict): obj[attr] = val
            else: setattr(obj, attr, val)

        node_id = get(node, 'id')
        if not node_id: return node

        # Initialize state if new
        if node_id not in self.node_states:
            self._initialize_node_state(node)
            
        state = self.node_states[node_id]
        
        # 1. Metabolism (Size adaptation)
        tx_volume = activity_metrics.get('transaction_volume', 0)
        target_size = self._calculate_target_size(node, tx_volume)
        
        state['current_size'] += (target_size - state['current_size']) * 0.1
        set_val(node, 'size', state['current_size'])
        
        # 2. Health Monitoring
        error_rate = activity_metrics.get('error_rate', 0)
        latency = activity_metrics.get('avg_latency', 0)
        
        health_score = self._calculate_health(error_rate, latency)
        state['health'] = health_score
        
        self._apply_health_visuals(node, health_score)
        
        # 3. Structural Adaptation
        self._apply_biological_motion(node, health_score)
        
        return node
    
    def _initialize_node_state(self, node: Any):
        """Initialize biological state for a node"""
        def get(obj, attr, default=None):
            return obj.get(attr, default) if isinstance(obj, dict) else getattr(obj, attr, default)

        node_id = get(node, 'id')
        node_size = get(node, 'size', 20)

        self.node_states[node_id] = {
            'current_size': node_size,
            'baseline_size': node_size,
            'health': 1.0,
            'stress_level': 0.0,
            'age': 0,
            'pulse_phase': random.random() * math.pi * 2
        }
        
    def _calculate_target_size(self, node: Any, volume: int) -> float:
        """Calculate target size based on activity volume"""
        def get(obj, attr, default=None):
            return obj.get(attr, default) if isinstance(obj, dict) else getattr(obj, attr, default)
            
        node_id = get(node, 'id')
        base = self.node_states[node_id]['baseline_size']
        growth_factor = math.log(volume + 1) * 2
        return base + growth_factor
    
    def _calculate_health(self, error_rate: float, latency: float) -> float:
        """Calculate health score (0.0 - 1.0)"""
        health = 1.0
        if error_rate > 0.05: health -= 0.3
        elif error_rate > 0.01: health -= 0.1
        
        if latency > 1000: health -= 0.2
        elif latency > 200: health -= 0.1
        
        return max(0.0, health)
    
    def _apply_health_visuals(self, node: Any, health: float):
        """Update node visuals based on health"""
        def set_val(obj, attr, val):
            if isinstance(obj, dict): obj[attr] = val
            else: setattr(obj, attr, val)

        if health < 0.5:
            set_val(node, 'status', 'critical')
        elif health < 0.8:
            set_val(node, 'status', 'warning')
        else:
            set_val(node, 'status', 'healthy')
            
    def _apply_biological_motion(self, node: Any, health: float):
        """Apply subtle biological movement"""
        def get(obj, attr, default=None):
            return obj.get(attr, default) if isinstance(obj, dict) else getattr(obj, attr, default)

        node_id = get(node, 'id')
        self.system_pulse += 0.05
        pulse = math.sin(self.system_pulse + self.node_states[node_id]['pulse_phase'])
        
        if health < 0.8:
            pulse = math.sin(self.system_pulse * 3 + self.node_states[node_id]['pulse_phase'])
        
        pass

# Global instance
living_graph_engine = LivingGraphEngine()
