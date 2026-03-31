"""Realtime Monitor – main module. Full implementation lives here until sub-module extraction."""
"""
Realtime Monitor

Polls connected databases for live business metrics, WEZU energy data, and DB diagnostics on each tick.
"""
from app.services.db_connector import db_connector
from app.services.anomaly_detector import anomaly_detector
from app.services.neural_core import neural_core
from datetime import datetime
from typing import Dict, Any
import time
import logging

logger = logging.getLogger(__name__)

class RealtimeMonitor:
    """Monitor database for real-time updates with intelligence"""
    
    def __init__(self):
        self.last_total_rows = 0
        self.last_time = time.time()
        self.initialized = False
        self.column_cache = {} # (conn_id, table) -> set(columns)
        self.wezu_cache: Dict[str, Dict[str, Any]] = {} # connection_id -> {node_name: data}
        
        # Debounce/Caching State
        self.last_metrics_update: Dict[str, float] = {} # connection_id -> last_tick
        self.cached_metrics: Dict[str, Dict[str, Any]] = {} # connection_id -> last_valid_total
        self.active_discovery_cache: Dict[str, Dict[str, Any]] = {} # connection_id -> meta_data

    def _get_key(self, row: dict, key: str):
        """Case-insensitive key fetch helper for cross-DB compatibility"""
        if key in row: return row[key]
        if key.upper() in row: return row[key.upper()]
        if key.lower() in row: return row[key.lower()]
        return None

    async def get_realtime_data(self, connection_id: str, table_name: str = None) -> dict:
        """Get real-time metrics with intelligence analysis. If table_name is provided, include node-specific analysis."""
        try:
            current_time = time.time()
            last_update = self.last_metrics_update.get(connection_id, 0)
            
            # [OPTIMIZATION] Debounce full DB metrics (10s cooldown)
            # This ensures that if the frontend polls every 2s, we only hit the DB for heavy stats every 10s.
            if current_time - last_update < 10.0 and connection_id in self.cached_metrics:
                return self.cached_metrics[connection_id]

            # 1. Get GLOBAL metrics
            db_metrics = await self._get_db_metrics(connection_id)
            
            # 2. Tick the Neural Core (Active Scanning)
            await neural_core.process_signal("_global", 1.0, connection_id=connection_id)
            
            # Ensure Memory Hydration (Lazy)
            if connection_id not in anomaly_detector.baseline_metrics:
                from app.services.generation_log_service import generation_log_service
                await generation_log_service.log_step(connection_id, "🧠 Hydrating anomaly sensor memory baseline", progress=40)
                await anomaly_detector.hydrate_memory(db_connector, connection_id)
            
            ai_stats = await neural_core.get_core_metrics()
            
            # 3. Real anomaly detection based on those metrics
            anomalies = await anomaly_detector.detect_anomalies(connection_id, db_metrics)
            if anomalies:
                from app.services.generation_log_service import generation_log_service
                await generation_log_service.log_step(connection_id, f"⚠️ Detected {len(anomalies)} anomalies in data stream", level="warning")
            
            # 4. Real health analysis (Global)
            health_status = await self._analyze_graph_health(connection_id, db_metrics)
            
            # 5. Node-Specific Metrics (if table_name provided)
            # This is still allowed once per tick if requested, but usually debounced by the caller.
            node_metrics = None
            if table_name:
                node_metrics = await self._get_node_specific_metrics(connection_id, table_name)

            data = {
                'type': 'metrics_update',
                'timestamp': datetime.now().isoformat(),
                'data': db_metrics,
                'health': health_status,
                'anomalies': anomalies,
                'ai_stats': ai_stats,
                'node_metrics': node_metrics
            }
            
            # Cache results and update timestamp
            self.cached_metrics[connection_id] = data
            self.last_metrics_update[connection_id] = current_time
            
            return data
            
        except Exception as e:
            logger.error(f"Error getting realtime data: {str(e)}")
            return {
                'type': 'error',
                'message': str(e),
                'timestamp': datetime.now().isoformat()
            }

    async def _get_db_metrics(self, connection_id: str) -> dict:
        """Fetch ACTUAL metrics from the database. Delegates to focused sub-methods."""
        try:
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info['type']

            current_time = time.time()
            time_delta = current_time - self.last_time
            if time_delta == 0: time_delta = 1

            # 1. Total Row Count
            total_rows = 0
            from app.services.schema_analyzer import schema_analyzer
            schema = schema_analyzer.analysis_results.get(connection_id)
            if schema:
                tables = schema.tables if hasattr(schema, 'tables') else schema.get('tables', [])
                total_rows = sum(
                    (t.row_count if hasattr(t, 'row_count') else t.get('row_count', 0))
                    for t in tables
                )
            else:
                if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                    sql = "SELECT SUM(n_live_tup) as total FROM pg_stat_user_tables"
                    res = await db_connector.query(connection_id, sql)
                    if res and res[0]['total'] is not None:
                        total_rows = int(res[0]['total'])
                elif db_type == 'mysql':
                    sql = "SELECT SUM(TABLE_ROWS) as total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()"
                    res = await db_connector.query(connection_id, sql)
                    if res and res[0]['total'] is not None:
                        total_rows = int(res[0]['total'])

            row_delta = max(0, total_rows - self.last_total_rows) if self.initialized else 0
            tps = round(row_delta / time_delta, 2)

            # 2. DB Agnostic setup
            is_pg = db_type in ['postgresql', 'postgres', 'neon', 'neon_db']
            like_op = "ILIKE" if is_pg else "LIKE"
            db_func = "current_database()" if is_pg else "DATABASE()"
            schema_clause = "table_schema = 'public'" if is_pg else f"table_schema = {db_func}"

            # 3. Sub-metric fetches (each isolated so one failure can't blank all stats)
            wezu = await self._get_wezu_metrics(connection_id)
            try:
                tx = await self._get_transaction_metrics(connection_id, db_type, is_pg, like_op, schema_clause)
            except Exception as e:
                logger.warning(f"[RealtimeMonitor] Transaction metrics failed for {connection_id}: {e}")
                tx = {'total_tx': 0, 'avg_amount': 0.0, 'fraud_alerts': 0, 'failed_tx': 0}
            diag = await self._get_db_diagnostics(connection_id, db_type)

            # 4. Update state
            self.last_total_rows = total_rows
            self.last_check_time = current_time
            self.initialized = True

            return {
                'transaction_rate': tps,
                'total_transactions': tx['total_tx'],
                'fraud_alerts': tx['fraud_alerts'],
                'average_amount': tx['avg_amount'],
                'failed_transactions': tx['failed_tx'],
                'active_connections': diag['active_conns'],
                'cache_hit_rate': diag['cache_hit_rate'],
                # Energy Extension
                'active_batteries': wezu['active_batteries'],
                'online_stations': wezu['online_stations'],
                'network_health': wezu['avg_soh'],
                'energy_alerts': wezu['critical_energy_alerts'],
                # Simulation Data
                'avg_battery_temp': getattr(self, 'last_battery_temp', 0),
                'avg_battery_volt': getattr(self, 'last_battery_volt', 0),
                'avg_battery_curr': getattr(self, 'last_battery_curr', 0),
            }
        except Exception as e:
            logger.error(f"Metric Fetch Error: {e}", exc_info=True)
            return {
                'transaction_rate': 0,
                'total_transactions': self.last_total_rows,
                'active_connections': 0,
                'cache_hit_rate': 99.0,
                'active_batteries': 0,
                'online_stations': 0,
                'network_health': 0,
                'energy_alerts': 0,
                'avg_battery_temp': getattr(self, 'last_battery_temp', 0),
                'avg_battery_volt': getattr(self, 'last_battery_volt', 0),
                'avg_battery_curr': getattr(self, 'last_battery_curr', 0),
            }


    async def _get_wezu_metrics(self, connection_id: str) -> dict:
        """Fetch WEZU energy-specific metrics (batteries, stations, alerts)."""
        avg_soh = 0
        active_batteries = 0
        online_stations = 0
        critical_energy_alerts = 0

        try:
            # Core query — only uses columns that always exist in the batteries table
            batt_res = await db_connector.query(connection_id, """
                SELECT COUNT(*) as count, AVG(COALESCE(soh_percentage, 100)) as avg_soh
                FROM batteries
            """)
            if batt_res:
                row = batt_res[0]
                active_batteries = int(row.get('count') or 0)
                avg_soh = round(float(row.get('avg_soh') or 0), 1)
                logger.debug(f"[WEZU] batteries: count={active_batteries} soh={avg_soh}")
        except Exception as e:
            logger.warning(f"[RealtimeMonitor] Battery core query failed: {e}", exc_info=True)

        # Optional telemetry — fails silently if column names differ per deployment
        try:
            tel_res = await db_connector.query(connection_id,
                "SELECT AVG(temperature) as t, AVG(voltage) as v, AVG(current_a) as c FROM batteries")
            if tel_res:
                row = tel_res[0]
                if row.get('t'): self.last_battery_temp = round(float(row['t']), 1)
                if row.get('v'): self.last_battery_volt = round(float(row['v']), 1)
                if row.get('c'): self.last_battery_curr = round(float(row['c']), 1)
        except Exception:
            pass  # Telemetry columns vary per deployment; non-critical

        try:
            stat_res = await db_connector.query(connection_id, "SELECT COUNT(*) as count FROM stations")
            if stat_res:
                online_stations = int(stat_res[0].get('count') or 0)
        except Exception as e:
            logger.warning(f"[RealtimeMonitor] Station query failed: {e}")

        try:
            alerts_res = await db_connector.query(connection_id, """
                SELECT COUNT(*) as count FROM batteries WHERE soh_percentage < 30
            """)
            if alerts_res:
                critical_energy_alerts = int(alerts_res[0].get('count') or 0)
        except Exception as e:
            logger.warning(f"[RealtimeMonitor] Alert query failed: {e}")

        return {
            'avg_soh': avg_soh,
            'active_batteries': active_batteries,
            'online_stations': online_stations,
            'critical_energy_alerts': critical_energy_alerts,
        }

    async def _get_transaction_metrics(self, connection_id: str, db_type: str, is_pg: bool,
                                       like_op: str, schema_clause: str) -> dict:
        """Discover and query the main transactional table for business KPIs."""
        total_tx = 0
        avg_amount = 0.0
        fraud_alerts = 0
        failed_tx = 0

        cache = self.active_discovery_cache.get(connection_id, {})
        now = time.time()

        if 'tx_table' not in cache or now - cache.get('tx_t', 0) > 60:
            # Priority order: prefer specific transactional tables over generic log tables
            discovery_query = f"""
                SELECT table_name
                FROM information_schema.tables
                WHERE {schema_clause}
                AND (table_name {like_op} '%transaction%'
                     OR table_name {like_op} '%payment%'
                     OR table_name {like_op} '%order%'
                     OR table_name {like_op} '%event%'
                     OR table_name {like_op} '%log%')
                ORDER BY
                    CASE
                        WHEN table_name {like_op} '%transaction%' THEN 1
                        WHEN table_name {like_op} '%payment%'     THEN 2
                        WHEN table_name {like_op} '%order%'       THEN 3
                        WHEN table_name {like_op} '%event%'       THEN 4
                        ELSE 5
                    END
                LIMIT 1
            """
            table_res = await db_connector.query(connection_id, discovery_query)
            tx_table = self._get_key(table_res[0], 'table_name') if table_res else None
            logger.info(f"[TxDiscovery] {connection_id}: selected table={tx_table!r}")

            col_names = []
            if tx_table:
                param_placeholder = "$1" if is_pg else "%s"
                cols_query = f"SELECT column_name FROM information_schema.columns WHERE table_name = {param_placeholder} AND {schema_clause}"
                cols = await db_connector.query(connection_id, cols_query, (tx_table,))
                col_names = [self._get_key(c, 'column_name').lower() for c in cols]

            cache['tx_table'] = tx_table
            cache['tx_cols'] = col_names
            cache['tx_t'] = now
            # Persist cache back so subsequent calls within the 60s window skip re-discovery
            self.active_discovery_cache[connection_id] = cache

        tx_table = cache.get('tx_table')
        col_names = cache.get('tx_cols', [])

        if tx_table:
            amount_col = next((c for c in col_names if 'amount' in c or 'total' in c or 'price' in c), None)
            status_col = next((c for c in col_names if 'status' in c or 'state' in c), None)

            select_parts = ["COUNT(*) as count"]
            amount_col_quoted = self._q(db_type, amount_col) if amount_col else None
            status_col_quoted = self._q(db_type, status_col) if status_col else None

            if amount_col:
                select_parts.append(f"AVG({amount_col_quoted}) as avg_val")

            tx_res = await db_connector.query(connection_id, f"SELECT {', '.join(select_parts)} FROM {self._q(db_type, tx_table)}")
            if tx_res:
                total_tx = tx_res[0]['count']
                avg_amount = round(float(tx_res[0].get('avg_val') or 0), 2)
                logger.info(f"[TxMetrics] {connection_id}: table={tx_table!r} count={total_tx} amount_col={amount_col!r}")

            if amount_col:
                fraud_res = await db_connector.query(connection_id, f"SELECT COUNT(*) as count FROM {self._q(db_type, tx_table)} WHERE {amount_col_quoted} > 5000")
                if fraud_res:
                    fraud_alerts = fraud_res[0]['count']

            if status_col:
                fail_res = await db_connector.query(connection_id, f"SELECT COUNT(*) as count FROM {self._q(db_type, tx_table)} WHERE {status_col_quoted} {like_op} '%fail%' OR {status_col_quoted} {like_op} '%err%'")
                if fail_res:
                    failed_tx = fail_res[0]['count']

        return {
            'total_tx': total_tx,
            'avg_amount': avg_amount,
            'fraud_alerts': fraud_alerts,
            'failed_tx': failed_tx,
        }

    async def _get_db_diagnostics(self, connection_id: str, db_type: str) -> dict:
        """Fetch database-level diagnostics: cache hit rate and active connection count."""
        cache_hit_rate = 99.0
        active_conns = 1

        if db_type in ('postgresql', 'postgres', 'neon', 'neon_db'):
            try:
                cache_sql = "SELECT (sum(blks_hit)*100.0/nullif(sum(blks_read+blks_hit),0)) as hit_rate FROM pg_stat_database"
                c_res = await db_connector.query(connection_id, cache_sql)
                if c_res and c_res[0].get('hit_rate'):
                    cache_hit_rate = round(float(c_res[0]['hit_rate']), 2)
                conn_sql = "SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'"
                cn_res = await db_connector.query(connection_id, conn_sql)
                if cn_res:
                    active_conns = int(cn_res[0]['count'])
            except Exception as e:
                logger.debug(f"PG diagnostics query failed for {connection_id}: {e}")
        elif db_type == 'mysql':
            try:
                conn_sql = "SELECT count(*) as count FROM information_schema.processlist WHERE command != 'Sleep'"
                cn_res = await db_connector.query(connection_id, conn_sql)
                if cn_res:
                    active_conns = int(cn_res[0]['count'])
                innodb_sql = "SHOW STATUS LIKE 'Innodb_buffer_pool_read%'"
                i_res = await db_connector.query(connection_id, innodb_sql)
                if i_res:
                    reads = {r['Variable_name']: int(r['Value']) for r in i_res}
                    reads_req = reads.get('Innodb_buffer_pool_read_requests', 0)
                    reads_disk = reads.get('Innodb_buffer_pool_reads', 0)
                    if reads_req > 0:
                        cache_hit_rate = round(((reads_req - reads_disk) / reads_req) * 100, 2)
            except Exception as e:
                logger.debug(f"MySQL diagnostics query failed for {connection_id}: {e}")

        return {'cache_hit_rate': cache_hit_rate, 'active_conns': active_conns}


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
                    logger.debug(f"[monitor] Suppressed: {e}")
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
        except Exception as e:
            logger.debug(f"[monitor] Suppressed: {e}")
        
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
                                    'insight': "Average value per record."
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

# Global instance
realtime_monitor = RealtimeMonitor()

# --- Sub-module split plan ---
# db_metrics_collector : _get_db_metrics, _get_wezu_metrics, _get_transaction_metrics, _get_db_diagnostics (102-335)
# health_analyzer      : _analyze_graph_health (365-521)
# node_metrics         : _get_node_specific_metrics (603-794)
# monitor              : get_realtime_data, get_wezu_node_data, __init__ (orchestration layer)
# Full split is the next sprint. Singleton is centralised here for backward compat.
