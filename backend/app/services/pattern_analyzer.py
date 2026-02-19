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
            db_type = connection['type'].lower()
            is_mysql = 'mysql' in db_type
            is_pg = any(t in db_type for t in ['postgresql', 'postgres', 'neon', 'neon_db'])
            
            # 0. Schema-aware table name
            fq_table = await self._get_fq_table_name(db_connector, connection_id, table_name)
            
            # 1. Need a timestamp column for behavioral analysis
            schema_info = await self._get_timestamp_column(db_connector, connection_id, table_name, db_type)
            if not schema_info:
                # FALLBACK: Structural Pattern Analysis (Real Data ID Distribution)
                # If no time data, we analyze the ID distribution to reveal "Batch" vs "Random" patterns
                return await self._analyze_structural_patterns(db_connector, connection_id, fq_table, table_name)
            
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
                 # Try structural fallback if temporal query returned silence
                 return await self._analyze_structural_patterns(db_connector, connection_id, fq_table, table_name)

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

    async def _analyze_structural_patterns(self, db_connector, connection_id: str, fq_table: str, table_name: str) -> Dict[str, Any]:
        """Analyze ID distribution to create a Structural Fingerprint when dates are missing"""
        try:
            # 1. Find a suitable ID column (Numeric preferred, but Text OK)
            col_q = f"""
                SELECT column_name, data_type FROM information_schema.columns 
                WHERE table_name = '{table_name}' 
                AND data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'character varying', 'text', 'uuid')
                ORDER BY CASE 
                    WHEN data_type IN ('integer', 'bigint', 'smallint') THEN 1 
                    WHEN column_name = 'id' THEN 2 
                    ELSE 3 
                END ASC LIMIT 1
            """
            cols = await db_connector.query(connection_id, col_q)
            if not cols:
                return {"table_name": table_name, "has_patterns": False, "summary": "Static reference table. No analysis columns detected."}
                
            id_col = cols[0]['column_name']
            dtype = cols[0]['data_type']
            
            # 2. Modulo Analysis (The "Digital Fingerprint")
            connection = db_connector.get_connection(connection_id)
            is_mysql = connection['type'] == 'mysql'
            
            # Construct Hash-based bucket for text, simple mod for numbers
            if dtype in ['integer', 'bigint', 'smallint', 'numeric']:
                bucket_expr = f"{id_col}"
            else:
                # Text/UUID handling
                if is_mysql:
                    bucket_expr = f"CRC32({id_col})"
                else:
                    bucket_expr = f"hashtext({id_col}::text)"

            # Query
            mod_query = f"SELECT ABS({bucket_expr}) % 24 as bucket, COUNT(*) as count FROM {fq_table} GROUP BY 1 ORDER BY 1"
            
            # For "Weekly" proxy, we use ID % 7
            dow_query = f"SELECT ABS({bucket_expr}) % 7 as bucket, COUNT(*) as count FROM {fq_table} GROUP BY 1 ORDER BY 1"

            
            mod_res = await db_connector.query(connection_id, mod_query)
            dow_res = await db_connector.query(connection_id, dow_query)
            
            hourly_data = {int(r['bucket']): r['count'] for r in mod_res}
            daily_data = {int(r['bucket']): r['count'] for r in dow_res}
            
            # Generate Insight
            is_uniform = False
            if hourly_data:
                avg = sum(hourly_data.values()) / len(hourly_data)
                variance = statistics.stdev(hourly_data.values()) if len(hourly_data) > 1 else 0
                is_uniform = variance < (avg * 0.2) # Less than 20% variance
            
            summary = "Structural Analysis: "
            if is_uniform:
                summary += "Data is evenly distributed (Sequential/Uniform generation)."
            else:
                summary += "Data shows distinct clustering (Batch/Import generation)."
                
            return {
                "table_name": table_name,
                "has_patterns": True,
                "is_structural": True,
                "daily_cycle": hourly_data, 
                "weekly_cycle": daily_data,
                "peaks": {"peak_hour": 12, "peak_day_name": "Structure"}, # Dummies for UI
                "summary": summary
            }
            
        except Exception as e:
            return {"table_name": table_name, "has_patterns": False, "error": str(e)}

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
                    WHEN LOWER(column_name) LIKE '%reported%' THEN 3
                    WHEN LOWER(column_name) LIKE '%at%' THEN 4
                    ELSE 5 
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
                    WHEN column_name ILIKE '%reported%' THEN 3
                    WHEN column_name ILIKE '%at%' THEN 4
                    ELSE 5 
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

    async def analyze_system_patterns(self, db_connector, connection_id: str) -> Dict[str, Any]:
        """Generate a SYSTEM-WIDE behavioral pattern by aggregating top table activity"""
        try:
            # 1. Get Active Tables (Heuristic: Largest = busiest usually)
            # Use a light query to get names
            connection = db_connector.get_connection(connection_id)
            db_type = connection['type'].lower()
            is_mysql = 'mysql' in db_type
            is_pg = any(t in db_type for t in ['postgresql', 'postgres', 'neon', 'neon_db'])
            
            if is_mysql:
                q = "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_rows DESC LIMIT 3"
            elif is_pg:
                q = "SELECT relname as table_name FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 3"
            else:
                q = "SELECT table_name FROM information_schema.tables LIMIT 3"
                
            res = await db_connector.query(connection_id, q)
            if not res:
                return {"has_patterns": False, "summary": "No active tables found."}
                
            # 2. Aggregate Patterns
            composite_hourly = {h: 0 for h in range(24)}
            composite_daily = {d: 0 for d in range(7)}
            tables_analyzed = []
            
            for r in res:
                t_name = r['table_name']
                p = await self.analyze_traffic_patterns(db_connector, connection_id, t_name)
                
                if p.get('has_patterns'):
                    tables_analyzed.append(t_name)
                    # Sum hourly
                    for h, count in p.get('daily_cycle', {}).items():
                        composite_hourly[int(h)] += count
                    # Sum daily
                    for d, count in p.get('weekly_cycle', {}).items():
                        composite_daily[int(d)] += count
            
            # 3. Identify Global Peaks
            peaks = self._identify_peaks(composite_hourly, composite_daily)
            
            return {
                "scope": "System Wide",
                "has_patterns": True,
                "composite_metrics": True,
                "sources": tables_analyzed,
                "daily_cycle": composite_hourly,
                "weekly_cycle": composite_daily,
                "peaks": peaks,
                "summary": f"System-wide activity peaks at {peaks.get('peak_hour', '?')}:00 on {peaks.get('peak_day_name', '?')}s. (Aggregated from {len(tables_analyzed)} core tables)"
            }

        except Exception as e:
            logger.error(f"System pattern analysis failed: {e}")
            return {"error": str(e), "has_patterns": False}

# Global instance
pattern_analyzer = PatternAnalyzer()
