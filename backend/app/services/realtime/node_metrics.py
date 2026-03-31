"""
Realtime Monitor — Node Metrics
Responsible for: get_wezu_node_data, _get_node_specific_metrics
"""
"""Realtime Monitor – main module. Full implementation lives here until sub-module extraction."""
"""
Realtime Monitor

Polls connected databases for live business metrics, WEZU energy data, and DB diagnostics on each tick.
"""
from app.services.db_connector import db_connector
from app.services.anomaly_detector import anomaly_detector
from app.services.neural_core import neural_core
from datetime import datetime
from typing import Dict, Any, List
import time
import logging

logger = logging.getLogger(__name__)

class RealtimeMonitor:
    async def get_wezu_node_data(self, connection_id: str) -> Dict[str, Any]:
        """Fetch WEZU-specific business metrics for for 3D Latent Mapping"""
        try:
            db_info = db_connector.get_connection(connection_id)
            db_type = db_info['type']
            q = self._q

            results = {}

            # 1. Batteries Detail (Revenue, SoH, Variance)
            try:
                # Actual columns: id, manufacturer, batch_id... 
                # Check for legacy columns before querying
                has_soh = await self._has_column(db_connector, connection_id, 'batteries', 'soh_percentage')
                has_rev = await self._has_column(db_connector, connection_id, 'batteries', 'lifetime_revenue')
                
                select_parts = ["id"]
                if has_soh: select_parts.append("soh_percentage")
                if has_rev: select_parts.append("lifetime_revenue")
                
                # Check for temperature (legacy vs new)
                temp_col = 'temperature_c'
                if await self._has_column(db_connector, connection_id, 'batteries', 'temperature'):
                    temp_col = 'temperature'
                elif not await self._has_column(db_connector, connection_id, 'batteries', 'temperature_c'):
                    temp_col = None # Neither exists
                
                if temp_col:
                    select_parts.append(temp_col)

                if await self._has_column(db_connector, connection_id, 'batteries', 'swap_variance'):
                    select_parts.append("swap_variance")

                batt_sql = f"SELECT {', '.join(select_parts)} FROM {q(db_type, 'batteries')} LIMIT 100"
                batt_res = await db_connector.query(connection_id, batt_sql)
                
                if batt_res:
                    # Map to the table node as an average for the graph
                    res_avg = {
                        'revenue': sum(float(r.get('lifetime_revenue') or 0) for r in batt_res),
                        'soh_percentage': sum(float(r.get('soh_percentage') or 85) for r in batt_res) / len(batt_res),
                        'avg_temperature': sum(float(r.get(temp_col) or 25.0) for r in batt_res) / len(batt_res) if temp_col else 25.0,
                        'vitality': int(sum(float(r.get('soh_percentage') or 85) for r in batt_res) / len(batt_res))
                    }
                    results['batteries'] = res_avg
            except Exception as e: 
                logger.warning(f"Monitor: Batteries scan warning: {e}")

            # 2. Stations Detail (Total Swaps, Capacity)
            try:
                # Actual columns: id, name, rating, total_reviews, status...
                has_name = await self._has_column(db_connector, connection_id, 'stations', 'name')
                has_swaps = await self._has_column(db_connector, connection_id, 'stations', 'total_swaps')
                
                stat_col = "name" if has_name else "id"
                select_parts = [stat_col]
                if has_swaps: select_parts.append("total_swaps")
                if await self._has_column(db_connector, connection_id, 'stations', 'inventory_level'):
                    select_parts.append("inventory_level")

                station_sql = f"SELECT {', '.join(select_parts)} FROM {q(db_type, 'stations')} LIMIT 100"
                station_res = await db_connector.query(connection_id, station_sql)
                if station_res:
                    total_swaps = sum(int(r.get('total_swaps') or 0) for r in station_res)
                    avg_inv = sum(int(r.get('inventory_level') or 10) for r in station_res) / len(station_res)
                    
                    results['stations'] = {
                        'revenue': total_swaps * 50, 
                        'vitality': int(min(100, (avg_inv / 20) * 100)),
                        'swap_frequency_variance': 0.0 # Removed random variance for "Real Data Only"
                    }
            except Exception as e:
                logger.warning(f"Monitor: Stations scan warning: {e}")
            
            self.wezu_cache[connection_id] = results
            return results
        except Exception as e:
            logger.error(f"Error fetching WEZU node data: {e}")
            return {}
    async def _get_node_specific_metrics(self, connection_id: str, table_name: str) -> dict:
        """Fetch high-fidelity mathematical diagnostics for a specific table with resilience"""
        # print(f"DEBUG: Starting deep scan for node: {table_name}")
        try:
            db_connector.validate_identifier(table_name)
            
            # Initialize with safe fallbacks
            idx_count = 0
            row_count = 0
            story_metrics = []
            growth_rate = 0.0
            projected_30d = 0
            samples = []
            null_count = 0

            # Auto-detect correct casing and DB type
            actual_table_name = table_name
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info['type']
            
            try:
                from app.services.schema_analyzer import schema_analyzer
                schema = schema_analyzer.get_analysis_result(connection_id)
                if schema:
                    match = next((t.name for t in schema.tables if t.name.lower() == table_name.lower()), None)
                    if match:
                        actual_table_name = match
            except Exception as e:
                logger.debug(f"Table name case resolution failed for {table_name}: {e}")

            # Use quoted identifiers for SQL safety
            is_pg = any(t in db_type.lower() for t in ['postgresql', 'postgres', 'neon', 'neon_db'])
            q_table = f'"{actual_table_name}"' if is_pg else f'`{actual_table_name}`'
            q_char = '"' if is_pg else '`'

            # Initialize defaults to prevent UnboundLocalError
            idx_count = 0
            row_count = 0
            growth_rate = 0.0
            projected_30d = 0
            story_metrics = []
            samples = []

            # 1. Structural Metadata (Index Count)
            is_pg = any(t in db_type.lower() for t in ['postgresql', 'postgres', 'neon', 'neon_db'])
            try:
                if is_pg:
                    db_connector.validate_identifier(actual_table_name)
                    idx_query = "SELECT count(*) as count FROM pg_indexes WHERE lower(tablename) = lower($1)"
                    idx_res = await db_connector.query(connection_id, idx_query, (actual_table_name,))
                else: # MySQL
                    idx_query = f"SHOW INDEX FROM {q_table}"
                    idx_res = await db_connector.query(connection_id, idx_query)
                if db_type == 'postgresql':
                    idx_count = int(idx_res[0]['count']) if idx_res else 0
                else:
                    # In MySQL, SHOW INDEX returns one row per column in index
                    idx_count = len(set(r['Key_name'] for r in idx_res)) if idx_res else 0
            except Exception as e:
                logger.debug(f"Index query fail: {e}")
            
            # 2. Precise Row Count
            try:
                count_query = f"SELECT count(*) as count FROM {q_table}"
                cnt_res = await db_connector.query(connection_id, count_query)
                row_count = int(cnt_res[0]['count']) if cnt_res else 0
                projected_30d = row_count
                # print(f"DEBUG: Row count for {table_name}: {row_count}")
            except Exception as e:
                logger.debug(f"Row count query fail: {e}")
            
            # 3. Deep Business Math: Aggregates & Structural Insights
            try:
                # Get numeric columns
                _param = "$1" if is_pg else "%s"
                num_cols_query = f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE lower(table_name) = lower({_param}) 
                    AND data_type IN ('integer', 'numeric', 'real', 'double precision', 'bigint', 'decimal', 'money', 'float', 'double')
                    LIMIT 3
                """
                num_cols = await db_connector.query(connection_id, num_cols_query, (actual_table_name,))
                
                if num_cols and row_count > 0:
                    agg_parts = [f'AVG({q_char}{c["column_name"]}{q_char}) as {q_char}avg_{c["column_name"]}{q_char}' for c in num_cols]
                    agg_res = await db_connector.query(connection_id, f"SELECT {', '.join(agg_parts)} FROM {q_table}")
                    if agg_res:
                        for c in num_cols:
                            raw_val = agg_res[0].get(f"avg_{c['column_name']}")
                            if raw_val is not None:
                                story_metrics.append({
                                    'label': c['column_name'].replace('_', ' ').title(),
                                    'value': round(float(raw_val), 2),
                                    'insight': f"Average value per record."
                                })
                                
                # If no numeric metrics, generate Structural Insights (REAL DATA)
                if not story_metrics:
                    story_metrics.append({
                        'label': 'Table Density',
                        'value': f"{row_count:,}",
                        'insight': 'Total active records tracked.'
                    })
                    if idx_count > 0:
                        story_metrics.append({
                            'label': 'Index Efficiency',
                            'value': round(row_count / idx_count, 0) if idx_count else 0,
                            'insight': 'Rows per index ratio.'
                        })
                    else:
                        story_metrics.append({
                            'label': 'Scan Cost',
                            'value': 'High',
                            'insight': 'No indexes found; full table scans likely.'
                        })

            except Exception as e:
                logger.debug(f"Math aggregate fail for {table_name}: {e}")
                # Fallbck to structural info
                story_metrics.append({'label': 'Status', 'value': 'Active', 'insight': 'Table is online.'})
 
            # 4. Growth Trend Math
            try:
                ts_types = "('timestamp', 'timestamp with time zone', 'timestamp without time zone', 'date')" if db_type == 'postgresql' else "('timestamp', 'datetime', 'date')"
                param_placeholder = "$1" if db_type == 'postgresql' else "%s"
                ts_cols_query = f"SELECT column_name FROM information_schema.columns WHERE lower(table_name) = lower({param_placeholder}) AND lower(data_type) IN {ts_types} LIMIT 1"
                ts_cols = await db_connector.query(connection_id, ts_cols_query, (actual_table_name,))
                
                if ts_cols:
                    ts_col = f'{q_char}{ts_cols[0]["column_name"]}{q_char}'
                    if db_type == 'postgresql':
                        growth_query = f"""
                            SELECT date_trunc('day', {ts_col}) as d, count(*) as c 
                            FROM {q_table} 
                            WHERE {ts_col} >= NOW() - INTERVAL '48 hours'
                            GROUP BY 1 ORDER BY 1 DESC
                        """
                    else: # MySQL
                        growth_query = f"""
                            SELECT DATE({ts_col}) as d, count(*) as c 
                            FROM {q_table} 
                            WHERE {ts_col} >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
                            GROUP BY d ORDER BY d DESC
                        """
                        
                    g_res = await db_connector.query(connection_id, growth_query)
                    if g_res and len(g_res) >= 2:
                        today = g_res[0]['c']
                        yesterday = g_res[1]['c']
                        if yesterday > 0:
                            growth_rate = round(((today - yesterday) / yesterday) * 100, 2)
                            projected_30d = int(row_count * (1 + (growth_rate/100 * 30)))
            except Exception as e:
                logger.debug(f"Growth calc fail: {e}")
 
            # 5. Sample Rows for Proof
            try:
                sample_res = await db_connector.query(connection_id, f"SELECT * FROM {q_table} LIMIT 3")
                def truncate_val(v):
                    if v is None: return "NULL"
                    if isinstance(v, str) and len(v) > 25: return v[:22] + "..."
                    return v
                if sample_res:
                    samples = [{k: truncate_val(v) for k, v in row.items()} for row in sample_res]
            except Exception as e:
                logger.debug(f"Sample fetch fail: {e}")
 
            # 6. Integrity Score
            score = 100
            if idx_count == 0: score -= 10
            if row_count > 1000 and idx_count < 2: score -= 5
 
            return {
                'table_name': table_name,
                'score': score,
                'row_count': row_count,
                'index_count': idx_count,
                'growth_rate': growth_rate,
                'projected_30d': projected_30d,
                'business_story': story_metrics,
                'samples': samples
            }
        except Exception as e:
            logger.error(f"CRITICAL Node Diagnostic Fail: {e}")
            return {
                'table_name': table_name,
                'score': 0,
                'row_count': 0,
                'business_story': [],
                'samples': [],
                'error': str(e)
            }
