"""
Pattern Analyzer Service
Detects daily/weekly patterns, traffic spikes, and behavioral trends.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import logging
import statistics

logger = logging.getLogger(__name__)

class PatternAnalyzer:
    """Service for analyzing behavioral patterns and system usage trends"""
    
    def __init__(self):
        self.pattern_cache = {}
        
    async def analyze_traffic_patterns(self, db_connector, connection_id: str, table_name: str) -> Dict[str, Any]:
        """Detect daily and weekly traffic patterns for a specific table"""
        try:
            connection = db_connector.get_connection(connection_id)
            db_type = connection['type']
            is_mysql = db_type == 'mysql'
            
            # 0. Schema-aware table name
            fq_table = await self._get_fq_table_name(db_connector, connection_id, table_name)
            
            # 1. Need a timestamp column for behavioral analysis
            schema_info = await self._get_timestamp_column(db_connector, connection_id, table_name, db_type)
            if not schema_info:
                return {"error": "No timestamp column found for pattern analysis", "has_patterns": False}
            
            ts_col = schema_info['column_name']
            
            # 2. Hourly Patterns (Daily Cycle)
            if is_mysql:
                hourly_query = f"""
                    SELECT HOUR({ts_col}) as hour, COUNT(*) as activity_count
                    FROM {fq_table}
                    WHERE {ts_col} >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    GROUP BY hour
                    ORDER BY hour
                """
            else:
                hourly_query = f"""
                    SELECT EXTRACT(HOUR FROM {ts_col}) as hour, COUNT(*) as activity_count
                    FROM {fq_table}
                    WHERE {ts_col} >= NOW() - INTERVAL '7 days'
                    GROUP BY hour
                    ORDER BY hour
                """
            hourly_results = await db_connector.query(connection_id, hourly_query)
            
            # 3. Daily Patterns (Weekly Cycle)
            if is_mysql:
                # MySQL DAYOFWEEK is 1 (Sun) - 7 (Sat)
                daily_query = f"""
                    SELECT (DAYOFWEEK({ts_col}) - 1) as dow, COUNT(*) as activity_count
                    FROM {fq_table}
                    WHERE {ts_col} >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY dow
                    ORDER BY dow
                """
            else:
                daily_query = f"""
                    SELECT EXTRACT(DOW FROM {ts_col}) as dow, COUNT(*) as activity_count
                    FROM {fq_table}
                    WHERE {ts_col} >= NOW() - INTERVAL '30 days'
                    GROUP BY dow
                    ORDER BY dow
                """
            daily_results = await db_connector.query(connection_id, daily_query)
            
            # Process results
            hourly_data = {int(r['hour']): r['activity_count'] for r in hourly_results}
            daily_data = {int(r['dow']): r['activity_count'] for r in daily_results}
            
            if not hourly_results and not daily_results:
                 return {
                    "table_name": table_name,
                    "has_patterns": False,
                    "summary": f"Neural Core is still observing {table_name}. Not enough temporal data points to establish a behavioral pattern yet."
                }

            # Normalize and find peaks
            peaks = self._identify_peaks(hourly_data, daily_data)
            
            return {
                "table_name": table_name,
                "has_patterns": True,
                "daily_cycle": hourly_data,
                "weekly_cycle": daily_data,
                "peaks": peaks,
                "summary": self._generate_pattern_summary(peaks, table_name)
            }
            
        except Exception as e:
            logger.error(f"Pattern analysis failed for {table_name}: {e}")
            return {"error": str(e), "has_patterns": False}

    async def _get_fq_table_name(self, db_connector, connection_id: str, table_name: str) -> str:
        """Get fully qualified table name (schema.table)"""
        # Check if evolution schema exists and has this table
        # information_schema is case-sensitive for some DBs, use LOWER
        check_query = f"""
            SELECT table_schema 
            FROM information_schema.tables 
            WHERE LOWER(table_name) = LOWER('{table_name}') 
            AND table_schema IN ('evolution', 'public')
            ORDER BY CASE WHEN table_schema = 'evolution' THEN 1 ELSE 2 END
            LIMIT 1
        """
        res = await db_connector.query(connection_id, check_query)
        if res:
            return f"{res[0]['table_schema']}.{table_name}"
        return table_name

    async def _get_timestamp_column(self, db_connector, connection_id: str, table_name: str, db_type: str = 'postgres') -> Optional[Dict]:
        """Find the most suitable timestamp column for activity analysis"""
        # MySQL doesn't have ILIKE, use LOWER() + LIKE
        if db_type == 'mysql':
            query = f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE LOWER(table_name) = LOWER('{table_name}') 
                AND data_type IN ('timestamp', 'datetime', 'date')
                ORDER BY CASE 
                    WHEN LOWER(column_name) LIKE '%created%' THEN 1
                    WHEN LOWER(column_name) LIKE '%updated%' THEN 2
                    WHEN LOWER(column_name) LIKE '%at%' THEN 3
                    ELSE 4 
                END
                LIMIT 1
            """
        else:
            query = f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE LOWER(table_name) = LOWER('{table_name}') 
                AND data_type IN ('timestamp', 'timestamp with time zone', 'timestamp without time zone', 'date')
                ORDER BY CASE 
                    WHEN column_name ILIKE '%created%' THEN 1
                    WHEN column_name ILIKE '%updated%' THEN 2
                    WHEN column_name ILIKE '%at%' THEN 3
                    ELSE 4 
                END
                LIMIT 1
            """
        results = await db_connector.query(connection_id, query)
        return results[0] if results else None

    def _identify_peaks(self, hourly_data: Dict[int, int], daily_data: Dict[int, int]) -> Dict[str, Any]:
        """Identify peak usage times and days"""
        if not hourly_data or not daily_data:
            return {}
            
        peak_hour = max(hourly_data, key=hourly_data.get)
        peak_day = max(daily_data, key=daily_data.get)
        
        days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        
        return {
            "peak_hour": peak_hour,
            "peak_day_index": peak_day,
            "peak_day_name": days[int(peak_day)],
            "is_weekend_heavy": daily_data.get(0, 0) + daily_data.get(6, 0) > sum(daily_data.values()) / 3
        }

    def _generate_pattern_summary(self, peaks: Dict, table_name: str) -> str:
        """Generate plain English summary of patterns"""
        if not peaks:
            return "No clear usage patterns detected yet."
            
        summary = f"Activity in {table_name} peaks around {peaks['peak_hour']}:00. "
        summary += f"The busiest day is typically {peaks['peak_day_name']}. "
        
        if peaks.get('is_weekend_heavy'):
            summary += "Usage is significantly higher during weekends."
        else:
            summary += "This table shows a typical weekday-focused business pattern."
            
        return summary

# Global instance
pattern_analyzer = PatternAnalyzer()
