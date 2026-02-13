"""
Anomaly Detection with Explainable AI
Detects anomalies and provides visual explanations.
States are persisted to ensure historical context survives restarts.
"""
from typing import Dict, List, Any, Tuple
import statistics
import json
import asyncio
from datetime import datetime

class AnomalyDetector:
    """Reality-Driven Anomaly Detection with Persistent Memory"""
    
    def __init__(self):
        self.baseline_metrics = {}  # connection_id -> baseline history
        self.anomaly_history = {}   # connection_id -> [anomalies]
        self.thresholds = {
            'z_score': 3.0,
            'noise_floor': 0.1
        }
    
    async def hydrate_memory(self, db_connector, connection_id: str):
        """Restore statistical baselines from the database."""
        try:
            sql = "SELECT metrics_json FROM evolution.statistical_memory WHERE connection_id = %s"
            res = await db_connector.query(connection_id, sql, (connection_id,))
            if res:
                self.baseline_metrics[connection_id] = json.loads(res[0]['metrics_json'])
                print(f"AnomalyDetector: Hydrated memory for {connection_id}")
        except:
            # Table might not exist yet
            self.baseline_metrics[connection_id] = {}

    async def detect_anomalies(self, connection_id: str, current_metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Detect anomalies using Reality-Driven baselines.
        Updates persistent memory on every tick.
        """
        anomalies = []
        if connection_id not in self.baseline_metrics:
            self.baseline_metrics[connection_id] = {}
        
        baseline = self.baseline_metrics[connection_id]
        
        # Sync metrics and detect
        for metric, value in current_metrics.items():
            if not isinstance(value, (int, float)): continue
            
            if metric not in baseline: baseline[metric] = []
            baseline[metric].append(value)
            
            # Keep rolling window of 200 points
            if len(baseline[metric]) > 200: baseline[metric].pop(0)
            
            if len(baseline[metric]) > 5:
                anomaly = self._zscore_analysis(metric, value, baseline[metric])
                if anomaly: anomalies.append(anomaly)
        
        # Persist Memory (Deferred to avoid blocking)
        asyncio.create_task(self._persist_memory(connection_id))
        
        return anomalies

    def _zscore_analysis(self, metric: str, current: float, history: List[float]) -> Dict[str, Any]:
        mean = statistics.mean(history)
        stdev = statistics.stdev(history) if len(history) > 1 else 0.1
        stdev = max(stdev, self.thresholds['noise_floor'])
        
        z = abs((current - mean) / stdev)
        if z > self.thresholds['z_score']:
            severity = "High" if z > 5 else "Medium"
            return {
                'metric': metric,
                'current_value': current,
                'expected_value': mean,
                'z_score': z,
                'severity': severity,
                'explanation': f"{metric.replace('_', ' ').title()} is exhibiting anomalous variance ({z:.1f}╧â)."
            }
        return None

    async def _persist_memory(self, connection_id: str):
        """Save statistical baselines to database."""
        from app.services.db_connector import db_connector
        try:
            # Ensure table
            await db_connector.query(connection_id, """
                CREATE SCHEMA IF NOT EXISTS evolution;
                CREATE TABLE IF NOT EXISTS evolution.statistical_memory (
                    connection_id TEXT PRIMARY KEY,
                    metrics_json JSONB,
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            
            data = json.dumps(self.baseline_metrics.get(connection_id, {}))
            sql = """
                INSERT INTO evolution.statistical_memory (connection_id, metrics_json, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (connection_id) DO UPDATE SET metrics_json = EXCLUDED.metrics_json, updated_at = NOW()
            """
            await db_connector.query(connection_id, sql, (connection_id, data))
        except Exception as e:
            print(f"AnomalyDetector: Memory persistence fail: {e}")

    def detect_cascading_failures(self, connection_id: str, current_anomalies: List[Dict]) -> List[Dict]:
        return [] # Simplified for Refactor

    def get_affected_nodes(self, anomaly: Dict[str, Any], graph_nodes: List[Dict]) -> List[str]:
        affected = []
        metric = anomaly['metric']
        entities = {'transaction_rate': ['transaction'], 'fraud_alerts': ['fraud']}
        relevant = entities.get(metric, ['transaction'])
        for node in graph_nodes:
            if node.get('entity') in relevant: affected.append(node['id'])
        return affected

    def generate_visual_overlay_data(self, anomaly: Dict[str, Any], affected_nodes: List[str]) -> Dict[str, Any]:
        return {
            'anomaly_id': f"anomaly_{datetime.now().timestamp()}",
            'type': anomaly['severity'],
            'affected_nodes': affected_nodes,
            'highlight_color': '#ff4757' if anomaly['severity'] == 'High' else '#ffd60a',
            'explanation': anomaly['explanation']
        }

# Global instance
anomaly_detector = AnomalyDetector()
