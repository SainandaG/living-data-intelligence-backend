from app.services.db_connector import db_connector
from app.services.anomaly_detector import anomaly_detector
from datetime import datetime
import random

class RealtimeMonitor:
    """Monitor database for real-time updates with intelligence"""
    
    async def get_realtime_data(self, connection_id: str) -> dict:
        """Get real-time metrics with intelligence analysis"""
        try:
            connection = db_connector.get_connection(connection_id)
            
            # Simulate real-time data (in production, query actual database)
            metrics = {
                'transaction_rate': random.randint(500, 1500),
                'total_transactions': random.randint(1000000, 2000000),
                'fraud_alerts': random.randint(0, 10),
                'average_amount': round(random.uniform(100, 5000), 2),
                'failed_transactions': random.randint(0, 50),
                'active_connections': 1
            }
            
            # Analyze graph health (Internal Logic)
            health_status = self._analyze_graph_health(metrics)
            
            # Detect anomalies
            anomalies = anomaly_detector.detect_anomalies(connection_id, metrics)
            
            data = {
                'type': 'metrics_update',
                'timestamp': datetime.now().isoformat(),
                'data': metrics,
                'health': health_status,
                'anomalies': anomalies
            }
            
            # Add particle flow data
            if random.random() > 0.7:  # 30% chance of new transaction
                particle_type = 'normal'
                
                # If there are anomalies, some particles should be red
                if anomalies and random.random() > 0.5:
                    particle_type = 'fraud' if any(a['severity'] == 'critical' for a in anomalies) else 'warning'
                
                data['particle'] = {
                    'from': random.choice(['accounts', 'customers', 'branches']),
                    'to': 'transactions',
                    'amount': round(random.uniform(10, 10000), 2),
                    'type': particle_type
                }
            
            return data
            
        except Exception as e:
            print(f"Error getting realtime data: {str(e)}")
            return {
                'type': 'error',
                'message': str(e),
                'timestamp': datetime.now().isoformat()
            }

    def _analyze_graph_health(self, metrics: dict) -> dict:
        """Internal logic to analyze system health based on metrics"""
        health_score = 100
        issues = []
        
        # Check transaction rate
        tx_rate = metrics.get('transaction_rate', 0)
        if tx_rate > 1200:
            health_score -= 20
            issues.append("High transaction load")
        elif tx_rate < 100:
            health_score -= 10
            issues.append("Low activity")
        
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
            
        return {
            'state': state,
            'score': max(0, health_score),
            'color': color,
            'issues': issues
        }

# Global instance
realtime_monitor = RealtimeMonitor()
