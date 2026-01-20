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
    
    def calculate_node_vitality(self, node: Dict[str, Any], metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate individual node vitality and adaptive properties
        """
        # Base vitality from row count
        # Base vitality - Logarithmic scale (Handle small & large datasets)
        row_count = node.get('row_count', 0)
        if row_count > 0:
            # log10(100) = 2 -> 30 + 28 = 58 (Healthy)
            # log10(10000) = 4 -> 30 + 56 = 86 (Very Healthy)
            base_vitality = min(100, 30 + (math.log10(row_count) * 14))
        else:
            base_vitality = 25 # Empty tables have low but not critical vitality
        
        # Adjust based on entity type
        entity = node.get('entity', 'other')
        if entity == 'transaction':
            # Transaction nodes are more vital
            vitality_multiplier = 1.5
        elif entity == 'fraud':
            # Fraud nodes vitality based on alert count
            vitality_multiplier = 1.2 + (metrics.get('fraud_alerts', 0) / 10)
        else:
            vitality_multiplier = 1.0
        
        vitality = min(100, base_vitality * vitality_multiplier)
        
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
                
                suggestions[node['id']] = {
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
