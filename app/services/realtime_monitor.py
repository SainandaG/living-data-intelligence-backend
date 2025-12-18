from app.services.db_connector import db_connector
from app.services.graph_intelligence import graph_intelligence
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
            
            # Analyze graph health
            health_status = graph_intelligence.analyze_graph_health(connection_id, metrics)
            
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

# Global instance
realtime_monitor = RealtimeMonitor()
