"""
Anomaly Detection with Explainable AI
Detects anomalies and provides visual explanations
"""
from typing import Dict, List, Any, Tuple
import statistics
from datetime import datetime

class AnomalyDetector:
    """Explainable Anomaly Detection System"""
    
    def __init__(self):
        self.baseline_metrics = {}  # connection_id -> baseline
        self.anomaly_history = {}  # connection_id -> [anomalies]
        self.thresholds = {
            'z_score': 3.0,  # Standard deviations
            'iqr_multiplier': 1.5
        }
    
    def detect_anomalies(self, connection_id: str, current_metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Detect anomalies in current metrics
        Returns list of anomalies with explanations
        """
        anomalies = []
        
        # Initialize baseline if needed
        if connection_id not in self.baseline_metrics:
            self.baseline_metrics[connection_id] = {
                'transaction_rate': [],
                'fraud_alerts': [],
                'failed_transactions': [],
                'average_amount': []
            }
        
        baseline = self.baseline_metrics[connection_id]
        
        # Check each metric
        for metric_name, current_value in current_metrics.items():
            if metric_name not in baseline:
                continue
            
            # Add to baseline history
            baseline[metric_name].append(current_value)
            if len(baseline[metric_name]) > 100:
                baseline[metric_name] = baseline[metric_name][-100:]
            
            # Need at least 10 data points for detection
            if len(baseline[metric_name]) < 10:
                continue
            
            # Detect using Z-score
            anomaly = self._detect_zscore_anomaly(
                metric_name,
                current_value,
                baseline[metric_name]
            )
            
            if anomaly:
                anomalies.append(anomaly)
        
        # Store anomalies
        if anomalies:
            if connection_id not in self.anomaly_history:
                self.anomaly_history[connection_id] = []
            
            for anomaly in anomalies:
                self.anomaly_history[connection_id].append({
                    **anomaly,
                    'timestamp': datetime.now().isoformat()
                })
            
            # Keep only last 50 anomalies
            if len(self.anomaly_history[connection_id]) > 50:
                self.anomaly_history[connection_id] = self.anomaly_history[connection_id][-50:]
        
        return anomalies
    
    def _detect_zscore_anomaly(self, metric_name: str, current_value: float, history: List[float]) -> Dict[str, Any]:
        """Detect anomaly using Z-score method"""
        if len(history) < 2:
            return None
        
        mean = statistics.mean(history)
        stdev = statistics.stdev(history)
        
        if stdev == 0:
            return None
        
        z_score = abs((current_value - mean) / stdev)
        
        if z_score > self.thresholds['z_score']:
            severity = "critical" if z_score > 5 else "warning"
            direction = "spike" if current_value > mean else "drop"
            
            return {
                'metric': metric_name,
                'current_value': current_value,
                'expected_value': mean,
                'deviation': current_value - mean,
                'z_score': z_score,
                'severity': severity,
                'direction': direction,
                'explanation': self._generate_explanation(metric_name, current_value, mean, direction, severity)
            }
        
        return None
    
    def _generate_explanation(self, metric: str, current: float, expected: float, direction: str, severity: str) -> str:
        """Generate natural language explanation"""
        deviation_pct = abs((current - expected) / expected * 100) if expected != 0 else 0
        
        explanations = {
            'transaction_rate': {
                'spike': f"Transaction rate is {deviation_pct:.1f}% higher than normal. Possible causes: marketing campaign, system load test, or DDoS attack.",
                'drop': f"Transaction rate is {deviation_pct:.1f}% lower than normal. Possible causes: system outage, network issues, or off-peak hours."
            },
            'fraud_alerts': {
                'spike': f"Fraud alerts increased by {deviation_pct:.1f}%. Possible coordinated attack or compromised accounts detected.",
                'drop': f"Fraud alerts decreased by {deviation_pct:.1f}%. System may be functioning normally or detection rules need review."
            },
            'failed_transactions': {
                'spike': f"Failed transactions up {deviation_pct:.1f}%. Possible causes: payment gateway issues, insufficient funds, or system errors.",
                'drop': f"Failed transactions down {deviation_pct:.1f}%. System stability improved."
            },
            'average_amount': {
                'spike': f"Average transaction amount {deviation_pct:.1f}% higher. Possible large purchases or unusual activity.",
                'drop': f"Average transaction amount {deviation_pct:.1f}% lower. Shift to smaller transactions detected."
            }
        }
        
        return explanations.get(metric, {}).get(direction, f"{metric} anomaly detected")
    
    def get_affected_nodes(self, anomaly: Dict[str, Any], graph_nodes: List[Dict]) -> List[str]:
        """
        Identify which nodes are affected by this anomaly
        """
        affected = []
        metric = anomaly['metric']
        
        # Map metrics to node types
        metric_to_entities = {
            'transaction_rate': ['transaction', 'account'],
            'fraud_alerts': ['fraud', 'transaction'],
            'failed_transactions': ['transaction'],
            'average_amount': ['transaction', 'account']
        }
        
        relevant_entities = metric_to_entities.get(metric, [])
        
        for node in graph_nodes:
            if node.get('entity') in relevant_entities:
                affected.append(node['id'])
        
        return affected
    
    def get_contributing_factors(self, anomaly: Dict[str, Any]) -> List[Dict[str, str]]:
        """
        Identify contributing factors for the anomaly
        """
        factors = []
        metric = anomaly['metric']
        
        if metric == 'transaction_rate':
            factors = [
                {'factor': 'Time of day', 'impact': 'High', 'description': 'Peak hours typically see 2-3x normal load'},
                {'factor': 'Day of week', 'impact': 'Medium', 'description': 'Weekends show different patterns'},
                {'factor': 'External events', 'impact': 'Variable', 'description': 'Sales, holidays, campaigns'}
            ]
        elif metric == 'fraud_alerts':
            factors = [
                {'factor': 'Account age', 'impact': 'High', 'description': 'New accounts more susceptible'},
                {'factor': 'Transaction pattern', 'impact': 'High', 'description': 'Unusual locations or amounts'},
                {'factor': 'Device fingerprint', 'impact': 'Medium', 'description': 'New or suspicious devices'}
            ]
        elif metric == 'failed_transactions':
            factors = [
                {'factor': 'Payment gateway', 'impact': 'High', 'description': 'Third-party service issues'},
                {'factor': 'Insufficient funds', 'impact': 'Medium', 'description': 'Customer account balance'},
                {'factor': 'Validation errors', 'impact': 'Low', 'description': 'Input validation failures'}
            ]
        
        return factors
    
    def generate_visual_overlay_data(self, anomaly: Dict[str, Any], affected_nodes: List[str]) -> Dict[str, Any]:
        """
        Generate data for visual overlay in 3D graph
        """
        return {
            'anomaly_id': f"anomaly_{datetime.now().timestamp()}",
            'type': anomaly['severity'],
            'affected_nodes': affected_nodes,
            'highlight_color': '#ff4757' if anomaly['severity'] == 'critical' else '#ffd60a',
            'pulse_speed': 2.0 if anomaly['severity'] == 'critical' else 1.0,
            'glow_intensity': 1.5 if anomaly['severity'] == 'critical' else 1.0,
            'show_connections': True,
            'explanation': anomaly['explanation'],
            'timestamp': datetime.now().isoformat()
        }
    
    def update_threshold(self, metric: str, new_threshold: float):
        """Allow users to adjust detection sensitivity"""
        if metric == 'z_score':
            self.thresholds['z_score'] = new_threshold
        elif metric == 'iqr_multiplier':
            self.thresholds['iqr_multiplier'] = new_threshold

# Global instance
anomaly_detector = AnomalyDetector()
