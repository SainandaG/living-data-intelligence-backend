"""
Living Graph Intelligence Engine
Manages graph state, health scoring, and adaptive behavior
"""
from typing import Dict, List, Any
from datetime import datetime
import math

class GraphIntelligence:
    """Digital Nervous System for Graph Management"""
    
    def __init__(self):
        self.graph_states = {}  # connection_id -> state
        self.health_history = {}  # connection_id -> [health_scores]
        
    def analyze_graph_health(self, connection_id: str, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze overall graph health based on metrics
        Returns: health_state, score, and recommendations
        """
        # Calculate health score (0-100)
        health_score = 100
        issues = []
        
        # Check transaction rate
        tx_rate = metrics.get('transaction_rate', 0)
        if tx_rate > 1200:
            health_score -= 20
            issues.append("High transaction load detected")
        elif tx_rate < 100:
            health_score -= 10
            issues.append("Unusually low transaction activity")
        
        # Check fraud alerts
        fraud_alerts = metrics.get('fraud_alerts', 0)
        if fraud_alerts > 5:
            health_score -= 30
            issues.append(f"Critical: {fraud_alerts} fraud alerts")
        elif fraud_alerts > 0:
            health_score -= 10
            issues.append(f"Warning: {fraud_alerts} fraud alerts")
        
        # Check failed transactions
        failed_tx = metrics.get('failed_transactions', 0)
        if failed_tx > 30:
            health_score -= 25
            issues.append("High failure rate")
        elif failed_tx > 10:
            health_score -= 10
            issues.append("Elevated failure rate")
        
        # Determine state
        if health_score >= 80:
            state = "healthy"
            color = "#00ff88"
        elif health_score >= 50:
            state = "stressed"
            color = "#ffd60a"
        else:
            state = "anomalous"
            color = "#ff4757"
        
        # Store in history
        if connection_id not in self.health_history:
            self.health_history[connection_id] = []
        self.health_history[connection_id].append({
            'timestamp': datetime.now().isoformat(),
            'score': health_score,
            'state': state
        })
        
        # Keep only last 100 entries
        if len(self.health_history[connection_id]) > 100:
            self.health_history[connection_id] = self.health_history[connection_id][-100:]
        
        return {
            'state': state,
            'score': health_score,
            'color': color,
            'issues': issues,
            'timestamp': datetime.now().isoformat()
        }
    
    def record_health_snapshot(self, connection_id: str, score: int, state: str) -> None:
        """Record a health snapshot for trend history (e.g. from realtime_monitor)."""
        if connection_id not in self.health_history:
            self.health_history[connection_id] = []
        self.health_history[connection_id].append({
            'timestamp': datetime.now().isoformat(),
            'score': score,
            'state': state
        })
        if len(self.health_history[connection_id]) > 100:
            self.health_history[connection_id] = self.health_history[connection_id][-100:]
    
    def get_authenticated_metrics(self, table_name: str, row_count: int, in_degree: int, out_degree: int, total_system_connections: int = 200) -> Dict[str, Any]:
        """
        Master source of truth for all system metrics.
        Returns authenticated values and LaTeX-style proof strings.
        
        Spec:
        V = Γ(N, G) -> Tiered Logarithmic Progression weighted by G.
        G = σ(ΣR * 2 + d_out + log(N)) -> Sigmoid structural mass.
        H = -Σ p(i) log2 p(i) -> Shannon Entropy relative to global topology.
        """
        # 1. AUTHENTICATED GRAVITY (G)
        # We use natural log (ln) to avoid the "flatness" of log10 for small row counts.
        # R_sum = ΣR * 2 + d_out
        r_sum = (in_degree * 2.0) + (out_degree * 1.0)
        n_factor = math.log(max(1, row_count))
        
        raw_mass = r_sum + n_factor
        
        # Sigmoid Centering: For a table with 0 connections and 1000 rows (ln 1000 = 6.9), 
        # we center the sigmoid around 10 to provide good contrast for hub nodes.
        sigmoid_imp = 1 / (1 + math.exp(-(raw_mass - 10.0) / 2.0))
        gravity = 1.0 + (sigmoid_imp * 4.0)
        
        # 2. AUTHENTICATED VITALITY (V)
        # Tiered Logarithmic Progression (Γ)
        if row_count == 0:
            base_v = 15.0
        elif row_count < 100:
            base_v = 30.0 + (row_count / 100.0) * 10.0
        elif row_count < 1000:
            base_v = 40.0 + (math.log10(row_count) - 2.0) * 15.0
        elif row_count < 10000:
            base_v = 55.0 + (math.log10(row_count) - 3.0) * 15.0
        else:
            base_v = 70.0 + min(30.0, (math.log10(row_count) - 4.0) * 10.0)
            
        # Gravity weighting: G > 2.5 grants bonus health
        gravity_bonus = (gravity - 2.5) * 5.0
        vitality = min(100.0, max(5.0, base_v + gravity_bonus))

        # 3. AUTHENTICATED ENTROPY (H)
        # H = -Σ p(i) log2 p(i) -> Shannon Entropy of the local connectivity distribution
        # We define the distribution as the balance between In-bound and Out-bound information flow.
        
        node_conn = in_degree + out_degree
        entropy = 0.0
        
        if node_conn > 0:
            p_in = in_degree / node_conn
            p_out = out_degree / node_conn
            
            # Calculate terms, handling log(0) by treating 0*log(0) as 0
            term_in = 0.0
            if p_in > 0:
                term_in = p_in * math.log2(p_in)
                
            term_out = 0.0
            if p_out > 0:
                term_out = p_out * math.log2(p_out)
                
            entropy = -(term_in + term_out)
        else:
            entropy = 0.0

        return {
            "gravity": round(gravity, 4),
            "vitality": round(vitality, 1),
            "entropy": round(entropy, 4),
            "pull_factor": f"{ ( (sigmoid_imp * 0.8) + (min(2.0, gravity/3.0) * 0.2) ):.2f}x",
            "proofs": {
                "gravity": f"G = σ(2R + d_out + ln(N)) = {gravity:.4f}",
                "vitality": f"V = Γ(N, G) = {vitality:.1f}%",
                "entropy": f"H(x) = -Σ P(x)log2 P(x) = {entropy:.4f}"
            }
        }

    def calculate_unified_vitality(self, row_count: int, importance: float) -> float:
        """Legacy wrapper - please use get_authenticated_metrics"""
        auth = self.get_authenticated_metrics("legacy", row_count, 0, 0)
        return auth['vitality']

    def get_gravity_pull(self, neural_gravity: float, gnn_importance: float) -> str:
        """
        Bridge to authenticated pull factor.
        """
        base_pull = (gnn_importance * 0.8) + (min(2.0, neural_gravity / 3.0) * 0.2)
        return f"{base_pull:.2f}x"

    def calculate_node_vitality(self, node: Dict[str, Any], metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deprecated - use calculate_unified_vitality for the score. 
        This remains for pulse/glow/size calculations in legacy contexts.
        """
        row_count = node.get('row_count', node.get('record_count', 0))
        gravity = node.get('importance_score', node.get('centrality', 1.0))
        
        vitality = self.calculate_unified_vitality(row_count, gravity)
        
        # Calculate pulse rate (higher vitality = faster pulse)
        pulse_rate = 0.5 + (vitality / 100) * 1.5  # 0.5 to 2.0 seconds
        
        # Calculate glow intensity
        glow_intensity = 0.3 + (vitality / 100) * 0.7  # 0.3 to 1.0
        
        # Determine if node should grow/shrink
        size_modifier = 1.0
        if vitality > 80:
            size_modifier = 1.2  # Grow by 20%
        elif vitality < 30:
            size_modifier = 0.8  # Shrink by 20%
        
        return {
            'vitality': vitality,
            'pulse_rate': pulse_rate,
            'glow_intensity': glow_intensity,
            'size_modifier': size_modifier,
            'should_highlight': vitality > 90 or vitality < 20
        }
    
    def detect_node_relationships_strength(self, node_id: str, edges: List[Dict], metrics: Dict) -> float:
        """
        Calculate relationship strength based on data flow
        """
        # Count connections
        connections = sum(1 for edge in edges if edge.get('source') == node_id or edge.get('target') == node_id)
        
        # More connections = stronger in the graph
        strength = min(1.0, connections / 10)
        
        return strength
    
    def suggest_node_repositioning(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, Dict]:
        """
        Suggest new positions for nodes based on activity and relationships
        """
        suggestions = {}
        
        # Group nodes by entity type
        entity_groups = {}
        for node in nodes:
            entity = node.get('entity', 'other')
            if entity not in entity_groups:
                entity_groups[entity] = []
            entity_groups[entity].append(node)
        
        # Position groups in clusters
        angle_step = (2 * math.pi) / len(entity_groups)
        radius = 200
        
        for i, (entity, group_nodes) in enumerate(entity_groups.items()):
            base_angle = i * angle_step
            
            for j, node in enumerate(group_nodes):
                # Spread within group
                sub_angle = base_angle + (j / len(group_nodes)) * (angle_step * 0.8)
                sub_radius = radius + (j % 3) * 50
                
                x = sub_radius * math.cos(sub_angle)
                y = sub_radius * math.sin(sub_angle)
                z = (j % 5 - 2) * 30  # Vary z position
                
                node_id = node.get('id', node.get('name', 'unknown'))
                suggestions[node_id] = {
                    'x': x,
                    'y': y,
                    'z': z,
                    'reason': f'Clustered with {entity} entities'
                }
        
        return suggestions
    
    def generate_health_report(self, connection_id: str) -> Dict[str, Any]:
        """
        Generate comprehensive health report
        """
        if connection_id not in self.health_history:
            return {'status': 'no_data'}
        
        history = self.health_history[connection_id]
        
        # Calculate trends
        recent_scores = [h['score'] for h in history[-10:]]
        avg_score = sum(recent_scores) / len(recent_scores) if recent_scores else 0
        
        trend = "stable"
        if len(recent_scores) >= 2:
            if recent_scores[-1] > recent_scores[0] + 10:
                trend = "improving"
            elif recent_scores[-1] < recent_scores[0] - 10:
                trend = "declining"
        
        return {
            'current_score': recent_scores[-1] if recent_scores else 0,
            'average_score': avg_score,
            'trend': trend,
            'history_length': len(history),
            'state_changes': self._count_state_changes(history)
        }
    
    def _count_state_changes(self, history: List[Dict]) -> int:
        """Count how many times state changed"""
        changes = 0
        prev_state = None
        for entry in history:
            if prev_state and entry['state'] != prev_state:
                changes += 1
            prev_state = entry['state']
        return changes

# Global instance
graph_intelligence = GraphIntelligence()
