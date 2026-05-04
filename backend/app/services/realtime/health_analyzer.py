"""
Realtime Monitor  Health Analyzer
Responsible for: _has_column, _q, _analyze_graph_health
"""
"""Realtime Monitor  main module. Full implementation lives here until sub-module extraction."""
"""
Realtime Monitor

Polls connected databases for live business metrics, WEZU energy data, and DB diagnostics on each tick.
"""
from app.services.db_connector import db_connector
from app.services.anomaly_detector import anomaly_detector
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class RealtimeMonitor:
    async def _has_column(self, db_connector, connection_id: str, table_name: str, column_name: str) -> bool:
        """Helper to verify column existence before querying"""
        cache_key = f"{connection_id}_{table_name}"
        if cache_key not in self.column_cache:
            try:
                safe_table = db_connector.validate_identifier(table_name)
                try:
                    conn_info = db_connector.get_connection(connection_id)
                    is_pg = any(t in conn_info['type'].lower() for t in ['postgresql', 'postgres', 'neon', 'neon_db'])
                except Exception as e:
                    logger.debug(f"[health_analyzer] Suppressed: {e}")
                    is_pg = True
                param_placeholder = "$1" if is_pg else "%s"
                sql = f"SELECT column_name FROM information_schema.columns WHERE table_name = {param_placeholder}"
                res = await db_connector.query(connection_id, sql, (safe_table,))
                self.column_cache[cache_key] = {self._get_key(r, 'column_name').lower() for r in res}
            except Exception as e:
                logger.debug(f"Column existence check failed for {table_name}.{column_name}: {e}")
                return False
        
        return column_name.lower() in self.column_cache.get(cache_key, set())
    def _q(self, db_type: str, name: str) -> str:
        """SQL Identifier quoting helper"""
        db_connector.validate_identifier(name)
        is_pg = any(t in db_type.lower() for t in ['postgresql', 'postgres', 'neon', 'neon_db'])
        return f'"{name}"' if is_pg else f'`{name}`'
    async def _analyze_graph_health(self, connection_id: str, metrics: dict) -> dict:
        """Analyze system health based on REAL metrics, anomalies and quality"""
        health_score = 100
        issues = []
        
        # 0. Get DB Type (Fix for UnboundLocalError)
        try:
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info['type']
        except Exception as e:
            logger.debug(f"Could not get db_type for health analysis, defaulting to postgresql: {e}")
            db_type = 'postgresql' # Default fallback
        
        # 1. Load Analysis
        tx_rate = metrics.get('transaction_rate', 0)
        if tx_rate > 5000:
            health_score -= 15
            issues.append("Extreme System Load")
        elif tx_rate > 1000:
            health_score -= 5
            issues.append("High Transaction Volume")
            
        # 2. Error Analysis
        failed_tx = metrics.get('failed_transactions', 0)
        total_tx = metrics.get('total_transactions', 0)
        if total_tx > 0:
            fail_pct = (failed_tx / total_tx) * 100
            if fail_pct > 10:
                health_score -= 30
                issues.append(f"Critical Failure Rate ({fail_pct:.1f}%)")
            elif fail_pct > 2:
                health_score -= 10
                issues.append(f"Elevated Failure Rate ({fail_pct:.1f}%)")

        # 3. Anomaly Integration
        anomalies = await anomaly_detector.detect_anomalies(connection_id, metrics)
        high_risk = [a for a in anomalies if a['severity'] == 'High']
        if high_risk:
            health_score -= 20 * len(high_risk)
            issues.append(f"{len(high_risk)} Critical Anomalies Detected")
            
        # 4. Data Quality Analysis (Reality-Driven)
        try:
            # Auto-discover a significant table to check integrity
            is_pg = db_type in ['postgresql', 'postgres', 'neon', 'neon_db']
            db_func = "current_database()" if is_pg else "DATABASE()"
            schema_clause = "table_schema = 'public'" if is_pg else f"table_schema = {db_func}"
            discovery_query = f"SELECT table_name FROM information_schema.tables WHERE {schema_clause} AND table_type = 'BASE TABLE' LIMIT 1"
            dq_res = await db_connector.query(connection_id, discovery_query)
            
            if dq_res:
                target_table = self._get_key(dq_res[0], 'table_name')
                is_pg = db_type in ['postgresql', 'postgres', 'neon', 'neon_db']
                q_table = f'"{target_table}"' if is_pg else f'`{target_table}`'
                
                # Check for NULL density in top 3 columns
                param_placeholder = "$1" if is_pg else "%s"
                col_query = f"SELECT column_name FROM information_schema.columns WHERE table_name = {param_placeholder} LIMIT 3"
                cols = await db_connector.query(connection_id, col_query, (target_table,))
                
                if cols:
                    safe_cols = []
                    for c in cols:
                        c_name = self._get_key(c, 'column_name')
                        if c_name: safe_cols.append(c_name)
                        
                    null_checks = [f"SUM(CASE WHEN \"{c}\" IS NULL THEN 1 ELSE 0 END) as \"{c}_nulls\"" for c in safe_cols]
                    if db_type == 'mysql':
                        null_checks = [f"SUM(CASE WHEN `{c}` IS NULL THEN 1 ELSE 0 END) as `{c}_nulls`" for c in safe_cols]
                    
                    if null_checks:
                        data_check_query = f"SELECT COUNT(*) as total, {', '.join(null_checks)} FROM {q_table}"
                        check_results = await db_connector.query(connection_id, data_check_query)
                        
                        if check_results:
                            total = check_results[0]['total']
                            if total > 0:
                                for c in safe_cols:
                                    null_count = check_results[0].get(f"{c}_nulls", 0)
                                    null_pct = (null_count / total) * 100
                                    if null_pct > 20: # Over 20% NULLs in a discovered column
                                        health_score -= 5
                                        issues.append(f"High NULL Density: {target_table}.{c} ({null_pct:.1f}%)")

            # 5. Orphaned Node Detection (Topology Health)
            # Find nodes with in_degree and out_degree == 0
            from app.services.schema_analyzer import schema_analyzer
            schema = schema_analyzer.get_analysis_result(connection_id)
            if schema:
                orphans = []
                for table in schema.tables:
                    # Check if any FK points to it or if it has FKs
                    has_out = len(table.foreign_keys) > 0
                    has_in = any(table.name in [fk.referenced_table for fk in t.foreign_keys] for t in schema.tables)
                    
                    if not has_out and not has_in:
                        orphans.append(table.name)
                
                if orphans:
                    health_score -= min(len(orphans) * 2, 10) # Max 10 points hit
                    issues.append(f"Orphaned Nodes: {len(orphans)} tables disconnected from schema.")

        except Exception as e:
            logger.error(f"Deep Analysis Exception: {e}")

        except Exception as e:
            logger.debug(f"Data quality integration warning: {e}")

        health_score = max(5, min(100, health_score))
        
        # 5. Determine State and Color
        if health_score > 85:
            state = 'healthy'
            color = '#00ff88'
            pulse_speed = 1.0
            glow_intensity = 0.4
        elif health_score > 60:
            state = 'stressed'
            color = '#ffd60a'
            pulse_speed = 1.8
            glow_intensity = 0.7
        else:
            state = 'anomalous'
            color = '#ff4757'
            pulse_speed = 3.0
            glow_intensity = 1.0
        
        # Record for 24h trend (Intelligence Hub health history)
        try:
            from app.services.graph_intelligence import graph_intelligence
            graph_intelligence.record_health_snapshot(connection_id, health_score, state)
            # #region agent log
            try:
                import json
                import os
                import aiofiles
                _logpath = r"c:\Users\karth\living-data-intelligence-backend\.cursor\debug.log"
                os.makedirs(os.path.dirname(_logpath), exist_ok=True)
                async with aiofiles.open(_logpath, "a", encoding="utf-8") as _f:
                    await _f.write(json.dumps({"timestamp": datetime.now().isoformat(), "location": "realtime_monitor.py", "message": "Health snapshot recorded", "data": {"connection_id": connection_id, "score": health_score, "hypothesisId": "H4"}}) + "\n")
            except Exception as e:
                logger.debug(f"[health_analyzer] Suppressed: {e}")
            # #endregion
        except Exception as e:
            logger.debug(f"[health_analyzer] Suppressed: {e}")
        
        return {
            'state': state,
            'score': health_score,
            'color': color,
            'issues': issues,
            'visual_config': {
                'pulse_speed': pulse_speed,
                'glow_intensity': glow_intensity
            }
        }


