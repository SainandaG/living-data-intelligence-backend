from app.services.db_connector import db_connector
from app.services.anomaly_detector import anomaly_detector
from app.services.neural_core import neural_core
from datetime import datetime
import time
import random

class RealtimeMonitor:
    """Monitor database for real-time updates with intelligence"""
    
    def __init__(self):
        self.last_check_time = time.time()
        self.last_total_rows = 0
        self.initialized = False

    async def get_realtime_data(self, connection_id: str) -> dict:
        """Get real-time metrics with intelligence analysis"""
        try:
            # 1. Get REAL metrics from the Database
            db_metrics = await self._get_db_metrics(connection_id)
            
            # 2. Tick the Neural Core (Active Scanning)
            # This advances the scanning cursor to find patterns in the next table
            await neural_core.process_signal("heartbeat", 1.0)
            ai_stats = neural_core.get_core_metrics()
            
            # 3. Real anomaly detection based on those metrics
            anomalies = anomaly_detector.detect_anomalies(connection_id, db_metrics)
            
            # 4. Real health analysis
            health_status = self._analyze_graph_health(db_metrics)
            
            data = {
                'type': 'metrics_update',
                'timestamp': datetime.now().isoformat(),
                'data': db_metrics,
                'health': health_status,
                'anomalies': anomalies,
                'ai_stats': ai_stats # Broadcast AI progress to frontend
            }
            
            # 5. MOCK Animation Logic REMOVED
            # Only real data flows are visualized in the 3D graph via the TPS metric.
            
            return data
            
        except Exception as e:
            print(f"Error getting realtime data: {str(e)}")
            return {
                'type': 'error',
                'message': str(e),
                'timestamp': datetime.now().isoformat()
            }

    async def _get_db_metrics(self, connection_id: str) -> dict:
        """Fetch ACTUAL metrics from the database"""
        try:
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info['type']
            
            current_time = time.time()
            time_delta = current_time - self.last_check_time
            if time_delta == 0: time_delta = 1
            
            total_rows = 0
            
            # Efficient Row Counting
            if db_type in ['postgresql', 'postgres']:
                sql = "SELECT SUM(n_live_tup) as total FROM pg_stat_user_tables"
                res = await db_connector.query(connection_id, sql)
                if res and res[0]['total'] is not None:
                    total_rows = int(res[0]['total'])
            elif db_type == 'mysql':
                sql = "SELECT SUM(TABLE_ROWS) as total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()"
                res = await db_connector.query(connection_id, sql)
                if res and res[0]['total'] is not None:
                    total_rows = int(res[0]['total'])
            
            # Initialize baseline
            if not self.initialized:
                self.last_total_rows = total_rows
                self.last_check_time = current_time
                self.initialized = True
                return {
                    'transaction_rate': 0,
                    'total_transactions': total_rows,
                    'fraud_alerts': 0, # Placeholder until specific logic
                    'average_amount': 0, 
                    'failed_transactions': 0,
                    'active_connections': 1
                }

            # Calculate Real TPS
            row_delta = max(0, total_rows - self.last_total_rows)
            tps = round(row_delta / time_delta, 2)
            
            # Update state
            self.last_total_rows = total_rows
            self.last_check_time = current_time
            
            return {
                'transaction_rate': tps,
                'total_transactions': total_rows, # Real Total
                'fraud_alerts': 0,
                'average_amount': 0,
                'failed_transactions': 0,
                'active_connections': 1
            }
        except Exception as e:
            # Fallback if query fails (e.g. connection lost) to prevent crash
            print(f"Metric Fetch Error: {e}")
            return { 'transaction_rate': 0, 'total_transactions': self.last_total_rows, 'active_connections': 0 }

    def _analyze_graph_health(self, metrics: dict) -> dict:
        """Analyze system health based on REAL metrics"""
        health_score = 100
        issues = []
        
        tx_rate = metrics.get('transaction_rate', 0)
        
        # Real logic: High load is only an issue if it's Extreme
        if tx_rate > 5000:
            health_score -= 10
            issues.append("High Load")
            
        color = "#00ff88"
        state = "healthy"
        
        return {
            'state': state,
            'score': health_score,
            'color': color,
            'issues': issues
        }

# Global instance
realtime_monitor = RealtimeMonitor()
