from typing import Dict, List, Any, Optional
from datetime import datetime

class CausalIntelligence:
    """
    Causal Transition Engine & Narrative Reasoner
    Attributes latent motion to underlying database signals.
    """
    
    def __init__(self):
        self.causal_history: List[Dict[str, Any]] = []

    def attribute_transition(self, node_id: str, motion: Dict[str, Any], metrics: Dict[str, Any], anomalies: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Identify CAUSE of latent motion.
        """
        causes = []
        
        # 1. Analyze Risk (Y-Axis) shifts
        if motion.get('vy', 0) > 5.0:
            relevant_anomalies = [a for a in anomalies if node_id.lower() in [n.lower() for n in a.get('affected_nodes', [])]]
            if relevant_anomalies:
                causes.append(f"Anomaly detection: {relevant_anomalies[0].get('type')}")
            else:
                causes.append("General risk elevation in related metrics")

        # 2. Analyze Health (Z-Axis) shifts
        if motion.get('vz', 0) < -5.0:
            fail_rate = metrics.get('failed_transactions', 0) / max(1, metrics.get('transaction_rate', 1))
            if fail_rate > 0.05:
                causes.append(f"High system failure rate ({fail_rate:.1%})")
            else:
                causes.append("Degraded vitality/stability")

        # 3. Analyze Value (X-Axis) shifts
        if motion.get('vx', 0) > 10.0:
            causes.append("Significant volume growth/Scaling event")

        # Generate Narrative
        narrative = self._generate_narrative(node_id, motion, causes)
        
        insight = {
            'node_id': node_id,
            'timestamp': datetime.now().isoformat(),
            'causes': causes,
            'narrative': narrative,
            'pattern': motion.get('motion_pattern', 'stable')
        }
        
        if causes:
            self.causal_history.append(insight)
            if len(self.causal_history) > 100: self.causal_history.pop(0)
            
        return insight

    def _generate_narrative(self, node_id: str, motion: Dict[str, Any], causes: List[str]) -> str:
        """
        Generate human-readable semantic explanation.
        """
        pattern = motion.get('motion_pattern', 'stable')
        
        if pattern == 'stable':
            return f"{node_id} is maintaining nominal state."
            
        cause_str = f" due to {', '.join(causes)}" if causes else ""
        
        if pattern == 'accelerating':
            return f"{node_id} is showing rapid momentum{cause_str}. Intelligence suggests imminent state transition."
        elif pattern == 'collapsing':
            return f"CRITICAL: {node_id} is collapsing toward the risk boundary{cause_str}. Action recommended."
        elif pattern == 'drifting':
            return f"{node_id} is drifting in latent space{cause_str}. Observing for potential causality."
            
        return f"{node_id} state transition detected."

# Global instance
causal_intelligence = CausalIntelligence()
