from typing import List, Dict, Optional
from datetime import datetime, timedelta
import copy
import random
from app.models.schemas import Graph

class TimeMachine:
    """
    Time Travel and Simulation Engine.
    Manages historical states and simulates future scenarios.
    """
    
    def __init__(self):
        # In-memory storage for demo purposes
        # In production, this would use a time-series database (e.g., TimescaleDB)
        self.history: List[Dict] = []
        self.max_history_items = 100
        
    def capture_snapshot(self, graph: Graph, metrics: Dict):
        """Record current state for time travel"""
        snapshot = {
            'timestamp': datetime.now().isoformat(),
            'graph': copy.deepcopy(graph),
            'metrics': copy.deepcopy(metrics)
        }
        
        self.history.append(snapshot)
        
        # Prune old history
        if len(self.history) > self.max_history_items:
            self.history.pop(0)
            
    def get_history(self, hours: int = 1) -> List[Dict]:
        """Get historical snapshots for the last N hours"""
        # For demo: return all captured history
        return self.history
    
    def simulate_future(self, current_graph: Graph, scenario: str = 'normal') -> Graph:
        """
        Simulate future state based on valid scenarios:
        - 'normal': Predictive trend (linear projection)
        - 'load_spike': 10x traffic surge
        - 'fraud_burst': Coordinated attack simulation
        - 'outage': Service failure simulation
        """
        simulated = copy.deepcopy(current_graph)
        
        if scenario == 'load_spike':
            self._simulate_load_spike(simulated)
        elif scenario == 'fraud_burst':
            self._simulate_fraud_burst(simulated)
        elif scenario == 'outage':
            self._simulate_outage(simulated)
            
        return simulated
    
    def _simulate_load_spike(self, graph: Graph):
        """Simulate massive traffic increase"""
        for node in graph.nodes:
            if node.type == 'fact':
                # Fact tables explode in size
                node.size *= 2.5
                node.status = 'warning'
            
    def _simulate_fraud_burst(self, graph: Graph):
        """Simulate fraud attack"""
        # Find transaction node
        tx_node = next((n for n in graph.nodes if 'transaction' in n.id.lower()), None)
        
        if tx_node:
            tx_node.status = 'critical'
            tx_node.color = '#ff4757'  # Red
            
        # Affect connected accounts
        for node in graph.nodes:
            if 'account' in node.id.lower() and random.random() > 0.7:
                node.status = 'warning'
                
    def _simulate_outage(self, graph: Graph):
        """Simulate system failure"""
        for node in graph.nodes:
            if random.random() > 0.5:
                # Grey out nodes
                node.color = '#555555' 
                node.status = 'offline'

# Global instance
time_machine = TimeMachine()
