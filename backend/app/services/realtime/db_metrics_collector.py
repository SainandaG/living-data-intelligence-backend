"""
Realtime Monitor  DB Metrics Collector
Responsible for: _get_db_metrics, _get_wezu_metrics, _get_transaction_metrics, _get_db_diagnostics
"""
"""Realtime Monitor  main module. Full implementation lives here until sub-module extraction."""
"""
Realtime Monitor

Polls connected databases for live business metrics, WEZU energy data, and DB diagnostics on each tick.
"""
from app.services.db_connector import db_connector
import time
import logging

logger = logging.getLogger(__name__)

class RealtimeMonitor:
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
                total_rows = sum(t.get('row_count', 0) for t in schema.get('tables', []))
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

            # 3. Sub-metric fetches
            wezu = await self._get_wezu_metrics(connection_id)
            tx = await self._get_transaction_metrics(connection_id, db_type, is_pg, like_op, schema_clause)
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
            logger.error(f"Metric Fetch Error: {e}")
            return {
                'transaction_rate': 0,
                'total_transactions': self.last_total_rows,
                'active_connections': 0,
                'network_health': 0
            }
    async def _get_wezu_metrics(self, connection_id: str) -> dict:
        """Fetch WEZU energy-specific metrics (batteries, stations, alerts)."""
        avg_soh = 0
        active_batteries = 0
        online_stations = 0
        critical_energy_alerts = 0

        try:
            batt_res = await db_connector.query(connection_id, """
                SELECT
                    COUNT(*) as count,
                    AVG(COALESCE(soh_percentage, 100)) as avg_soh,
                    AVG(temperature) as avg_temp,
                    AVG(voltage) as avg_volt,
                    AVG(current_a) as avg_curr
                FROM batteries
            """)
            if batt_res:
                row = batt_res[0]
                active_batteries = int(row.get('count') or 0)
                avg_soh = round(float(row.get('avg_soh') or 0), 1)
                if row.get('avg_temp'): self.last_battery_temp = round(float(row['avg_temp']), 1)
                if row.get('avg_volt'): self.last_battery_volt = round(float(row['avg_volt']), 1)
                if row.get('avg_curr'): self.last_battery_curr = round(float(row['avg_curr']), 1)
        except Exception as e:
            logger.warning(f"[RealtimeMonitor] Battery query failed: {e}")

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

            col_names = []
            if tx_table:
                param_placeholder = "$1" if is_pg else "%s"
                cols_query = f"SELECT column_name FROM information_schema.columns WHERE table_name = {param_placeholder} AND {schema_clause}"
                cols = await db_connector.query(connection_id, cols_query, (tx_table,))
                col_names = [self._get_key(c, 'column_name').lower() for c in cols]

            cache['tx_table'] = tx_table
            cache['tx_cols'] = col_names
            cache['tx_t'] = now
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

