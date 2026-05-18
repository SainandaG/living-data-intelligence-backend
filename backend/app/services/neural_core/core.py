"""Neural Core  main module. Imports all sub-module method groups."""
"""
Neural Core Service
-------------------
Implements Active Schema Intelligence.
Instead of simulating training, this core actively scans the connected database schema
to build relationship graphs and calculate complexity metrics in real-time.
"""

import asyncio
import logging
from typing import List, Dict, Any
import math
from datetime import datetime
import time

logger = logging.getLogger(__name__)
try:
    from backend.app.services.latent_manager import latent_manager # type: ignore
except ImportError:
    from app.services.latent_manager import latent_manager # type: ignore

class NeuralCore:
    def __init__(self):
        self.model_state = "initializing"
        
        # Multi-connection State
        self.snapshots: Dict[str, Dict] = {} # connection_id -> snapshot
        self.adjacency_maps: Dict[str, Dict] = {} 
        self.in_degrees: Dict[str, Dict] = {} 
        self.out_degrees: Dict[str, Dict] = {}
        self.gravity_stores: Dict[str, Dict[str, float]] = {} # conn_id -> table -> gravity
        self.hub_scores: Dict[str, Dict[str, float]] = {}
        self.patterns_learned: Dict[str, int] = {}
        self.signal_counts: Dict[str, int] = {}
        self.analyzed_tables: Dict[str, set] = {}
        self.scan_cursors: Dict[str, int] = {}
        self.last_save_time: Dict[str, float] = {} # timestamp of last snapshot
        
        # Metrics & Status
        self.growth_factor = 1.0 
        self.agent_status = "IDLE"
        self.active_connection_id = None
        
        # Domain Specialization: WEZU Energy
        self.WEZU_ENERGY_ONTOLOGY = {
            "batteries": {"gravity_weight": 10.0, "type": "asset", "justification": "Primary storage unit in WEZU infrastructure; critical for energy distribution and grid stability."},
            "stations": {"gravity_weight": 9.0, "type": "infrastructure", "justification": "Physical points of interaction for battery swaps; core nodes in the distribution network."},
            "iot_devices": {"gravity_weight": 8.0, "type": "asset", "justification": "Remote sensors providing granular telemetry; critical for real-time monitoring and predictive maintenance."},
            "telematics_data": {"gravity_weight": 7.0, "type": "telemetry", "justification": "High-velocity stream of operational metrics; forms the basis for anomaly detection systems."},
            "battery_health_log": {"gravity_weight": 8.0, "type": "telemetry", "justification": "Historical ledger of SOH (State of Health) metrics; essential for long-term asset lifecycle analysis."},
            "gps_tracking_log": {"gravity_weight": 7.0, "type": "telemetry", "justification": "Spatial movement data for mobile assets; enables geographical pattern analysis and optimization."},
            "swap_transactions": {"gravity_weight": 7.0, "type": "transaction", "justification": "Event-based ledger of physical asset exchanges; core business metric for network utilization."},
            "rentals": {"gravity_weight": 7.0, "type": "transaction", "justification": "Consumer-facing lease agreements; primary revenue-generating events in the ecosystem."},
            "wallet_transactions": {"gravity_weight": 6.0, "type": "financial", "justification": "Monetary flow records; enables financial reconciliation and fraud detection auditing."},
            "warehouses": {"gravity_weight": 6.0, "type": "infrastructure", "justification": "Storage and maintenance hubs; supporting infrastructure for asset logistics and distribution."},
            "kyc_records": {"gravity_weight": 5.0, "type": "user", "justification": "Identity verification data; required for compliance and user trust framework safety."},
            "biometric_data": {"gravity_weight": 5.0, "type": "user", "justification": "Highly sensitive identifying attributes; used for secure secondary authentication protocols."},
            "battery_lifecycle_event": {"gravity_weight": 8.0, "type": "telemetry", "justification": "Major lifecycle transitions (Commission, Retiring, Recycling); key for sustainability tracking."},
            "rental_payments": {"gravity_weight": 6.0, "type": "financial", "justification": "Revenue capture events associated with equipment leases; critical for cash flow visibility."},
            "grid_metrics": {"gravity_weight": 9.0, "type": "infrastructure", "justification": "Macro-level energy grid stability data; essential for balancing network supply and demand."},
            "bess_units": {"gravity_weight": 9.5, "type": "infrastructure", "justification": "Battery Energy Storage Systems; large-scale grid-connected units for peak shaving operations."},
            "energy_trade_logs": {"gravity_weight": 8.5, "type": "transaction", "justification": "Inter-grid energy transfer records; evidence of wholesale market participation and arbitrage."}
        }
        
        # [PHASE 3] Rate Limiting
        # Prevent excessive re-analysis from frontend polling
        self.last_analysis_time: Dict[str, float] = {} 

    async def initialize(self):
        """Prepare the core for schema analysis"""
        self.model_state = "ready"
        logger.info("Neural Core: Visual Intelligence Engine Ready.")

    async def update_schema_context(self, schema: Dict, connection_id: str, edges: List[Dict] = None):
        """
        Receive the latest schema/graph snapshot to analyze.
        Updated to support both full Schema objects and raw Graph nodes+edges.
        """
        if not connection_id: return

        # [PHASE 3] Cooldown Check (5 seconds)
        # Hot-fix for attribute persistence during reload
        if not hasattr(self, 'last_analysis_time'):
            self.last_analysis_time = {}

        import os
        if os.getenv("APP_ENV") == "testing" or os.getenv("PYTEST_CURRENT_TEST"):
            pass
        else:
            current_time = time.time()
            last_time = self.last_analysis_time.get(connection_id, 0)
            if current_time - last_time < 5.0:
                return
            self.last_analysis_time[connection_id] = current_time

        self.snapshots[connection_id] = schema
        self.active_connection_id = connection_id

        # Initialize connection-specific metrics if not present
        if connection_id not in self.analyzed_tables:
            self.analyzed_tables[connection_id] = set()
            self.gravity_stores[connection_id] = {}
            self.hub_scores[connection_id] = {}
            self.patterns_learned[connection_id] = 0
            self.signal_counts[connection_id] = 0
            self.scan_cursors[connection_id] = 0
        else:
            self.analyzed_tables[connection_id].clear()
            self.patterns_learned[connection_id] = 0
            self.signal_counts[connection_id] = 0
            self.scan_cursors[connection_id] = 0
            
        self.agent_status = "ACTIVE_SCANNING"
            
        # Per-connection Topology
        adj = {}
        in_deg = {}
        out_deg = {}
        
        tables = schema.get('tables', [])
        for t in tables:
            t_name = t.get('name')
            if not t_name: continue
            if t_name not in adj: adj[t_name] = []
            if t_name not in in_deg: in_deg[t_name] = 0
            if t_name not in out_deg: out_deg[t_name] = 0
            
            # Explicit Schema foreign keys
            fks = t.get('foreign_keys', [])
            out_deg[t_name] += len(fks)
            for fk in fks:
                target = fk.get('referenced_table', fk.get('target_table'))
                if target:
                    in_deg[target] = in_deg.get(target, 0) + 1

        # Topology-based edges (Overlay/Graph)
        if edges:
            for edge in edges:
                source = edge.get('source')
                target = edge.get('target')
                if source and target:
                    out_deg[source] = out_deg.get(source, 0) + 1
                    in_deg[target] = in_deg.get(target, 0) + 1
        
        self.adjacency_maps[connection_id] = adj
        self.in_degrees[connection_id] = in_deg
        self.out_degrees[connection_id] = out_deg

    async def process_signal(self, node_id: str, intensity: float, connection_id: str = None, metadata: Dict = None):
        """
        Advance the analysis cursor for a specific connection. 
        Each 'signal' (tick) processes the next part of the real schema.
        """
        conn_id = connection_id or self.active_connection_id
        if not conn_id: return
        
        schema = await self._get_context(conn_id)
        if not schema or not schema.get('tables'):
            return

        tables = schema['tables']
        if not tables: return
        
        # Get connection state
        analyzed = self.analyzed_tables.get(conn_id, set())
        cursor = self.scan_cursors.get(conn_id, 0)

        # Collect unique target table names to scan
        unique_targets = set()
        for t in tables:
            name = t.get('name') if isinstance(t, dict) else getattr(t, 'name', None)
            if name and name != 'Neural Core':
                unique_targets.add(name)

        # OPTIMIZATION: Stop scanning if we are done
        if len(analyzed) >= len(unique_targets):
            # If manual re-calc specifically requested
            if node_id == "manual_recalc":
                analyzed.clear()
                self.patterns_learned[conn_id] = 0 # Reset metrics for re-scan
                self.signal_counts[conn_id] = 0
                self.scan_cursors[conn_id] = 0
                self.agent_status = "ACTIVE_SCANNING"
            else:
                self.agent_status = "IDLE (Optimized)"
                return
                
        # BATCH PROCESSING CONFIGURATION
        BATCH_SIZE = 10
        
        # Calculate batch indices
        start_idx = cursor % len(tables)
        indices = [(start_idx + i) % len(tables) for i in range(BATCH_SIZE)]
        
        # Collect unique tables to analyze in this batch
        batch_tables = []
        for idx in indices:
            batch_tables.append(tables[idx])
            
        # Process Batch
        for target_table in batch_tables:
            t_name = target_table.get('name')
            if not t_name: continue
            try:
                await self._analyze_table_intelligence(target_table, conn_id, analyzed)
            except Exception as e:
                logger.error(f"Neural Core: Error analyzing table {t_name}: {e}")
                analyzed.add(t_name)
                self.analyzed_tables[conn_id] = analyzed

        # Update global growth factor based on total connection knowledge
        total_complexity = sum(self.patterns_learned.values()) + (sum(self.signal_counts.values()) * 0.1)
        self.growth_factor = 1.0 + math.log10(max(1, total_complexity))

        # Advance Cursor by Batch Size
        self.scan_cursors[conn_id] = cursor + BATCH_SIZE
        self.agent_status = "COMPUTING_CENTRALITY" if cursor % 2 == 0 else "SIGMOID_GRAVITY_SYNC"

        # AUTO-SAVE: Rate Limited (Max once per 60s)
        import time
        now = time.time()
        last_save = self.last_save_time.get(conn_id, 0)
        
        if (now - last_save) > 60:
            # Trigger Latent Space Update
            # Extract basic node/edge structure for the GNN
            gnn_nodes = [{"id": t['name'], "metadata": t} for t in tables]
            gnn_edges = []
            for t in tables:
                for fk in t.get('foreign_keys', []):
                    if fk.get('target_table'):
                        gnn_edges.append({"source": t['name'], "target": fk['target_table']})
            
            # Fire and forget (or await if async)
            try:
                # [FIX] Offload heavy PCA/GNN to thread to avoid blocking event loop
                await asyncio.to_thread(latent_manager.update_latent_space, gnn_nodes, gnn_edges)
            except Exception as e:
                logger.error(f"Neural Core: Failed to update Latent Space: {e}")

            logger.info(f"Neural Core: Persisting state snapshot for {conn_id}")
            self.last_save_time[conn_id] = now
            asyncio.create_task(self.save_snapshot(conn_id))

    async def _analyze_table_intelligence(self, target_table: Dict, conn_id: str, analyzed_set: set):
        """
        Analyze a single table for intelligence metrics.
        Extracted for batch processing.
        """
        t_name = target_table['name']
        
        if t_name in analyzed_set:
            return

        # 1. Update Signal Data
        fks = len(target_table.get('foreign_keys', []))
        self.patterns_learned[conn_id] += fks
        
        cols = len(target_table.get('columns', []))
        self.signal_counts[conn_id] += cols
        
        # 2. Calculate Gravity (Structural Weight)
        in_deg_map = self.in_degrees.get(conn_id, {})
        out_deg_map = self.out_degrees.get(conn_id, {})
        
        in_deg = in_deg_map.get(t_name, 0)
        out_deg = out_deg_map.get(t_name, 0)
        
        # Centrality Score
        struct_centrality = (in_deg * 2.0) + (out_deg * 1.0)
        norm_struct = min(1.0, struct_centrality / 10.0)
        self.hub_scores.setdefault(conn_id, {})[t_name] = norm_struct

        # 2. Synchronized Metric Extraction (Master Specification)
        from app.services.graph_intelligence import graph_intelligence
        
        # Use authenticated formula for structural importance and gravity
        raw_rows = target_table.get('row_count')
        row_count = 0
        if raw_rows is not None:
            try:
                row_count = int(raw_rows)
            except (ValueError, TypeError):
                row_count = 0

        auth_metrics = graph_intelligence.get_authenticated_metrics(
            t_name, 
            row_count,
            in_deg,
            out_deg
        )
        
        self.hub_scores.setdefault(conn_id, {})[t_name] = auth_metrics['gravity'] / 5.0 # Normalized hub proxy
        base_gravity = auth_metrics['gravity']

        # Decay based on Interaction
        last_int = target_table.get('last_interaction')
        final_gravity = base_gravity
        if last_int:
            try:
                dt = datetime.fromisoformat(str(last_int).replace('Z', '+00:00'))
                now = datetime.now().astimezone() if dt.tzinfo else datetime.now()
                hours_since = (now - dt).total_seconds() / 3600
                decay = 1.0 / (1.0 + (hours_since / 168.0)) # 1 week half-life
                final_gravity = (base_gravity * 0.5) + (base_gravity * 0.5 * decay)
            except (ValueError, TypeError, OSError):
                pass  # Malformed timestamp  skip decay, use base gravity

        self.gravity_stores[conn_id][t_name] = final_gravity
        analyzed_set.add(t_name)
        self.analyzed_tables[conn_id] = analyzed_set

    async def save_snapshot(self, connection_id: str):
        """Persist the current neural state to the database"""
        from app.services.generation_log_service import generation_log_service
        current_snapshot = self.snapshots.get(connection_id)
        if not current_snapshot: 
            logger.warning("Neural Core: No schema snapshot to save.")
            return
        
        from app.services.db_connector import db_connector
        await generation_log_service.log_step(connection_id, " Persisting Neural State to evolution.neural_snapshots", progress=90)
        logger.info(f"Neural Core: Initiating snapshot save for {connection_id}")
        
        # 1. Create table if not exists (Lazy Init - Dialect Aware)
        try:
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info['type']
            
            if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                await db_connector.query(connection_id, "CREATE SCHEMA IF NOT EXISTS evolution")
                await db_connector.query(connection_id, """
                    CREATE TABLE IF NOT EXISTS evolution.neural_snapshots (
                        id SERIAL PRIMARY KEY,
                        connection_id TEXT NOT NULL,
                        snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        neural_data JSONB,
                        core_metrics JSONB
                    )
                """)
                await db_connector.query(connection_id, "CREATE INDEX IF NOT EXISTS idx_neural_conn ON evolution.neural_snapshots(connection_id)")
            elif db_type == 'mysql':
                # For MySQL, we'll use underscore prefix instead of schema if it fails,
                # but first try to use the current database.
                try:
                    await db_connector.query(connection_id, """
                        CREATE TABLE IF NOT EXISTS neural_snapshots (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            connection_id VARCHAR(255) NOT NULL,
                            snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            neural_data JSON,
                            core_metrics JSON,
                            INDEX idx_neural_conn (connection_id)
                        )
                    """)
                except Exception as mysql_e:
                    logger.error(f"MySQL Specific Initialization Error: {mysql_e}")
                    raise
            else:
                # Fallback for DuckDB/SQLite/others
                await db_connector.query(connection_id, """
                    CREATE TABLE IF NOT EXISTS neural_snapshots (
                        id INTEGER PRIMARY KEY,
                        connection_id TEXT NOT NULL,
                        snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        neural_data TEXT,
                        core_metrics TEXT
                    )
                """)
        except Exception as e:
            logger.error(f"Failed to init neural_snapshots table for {db_type}: {e}")
            return

        # 2. Prepare Data
        metrics = await self.get_core_metrics(connection_id)
        
        # Detailed Node State
        nodes = {}
        gravity_store = self.gravity_stores.get(connection_id, {})
        hub_scores = self.hub_scores.get(connection_id, {})
        
        for t in current_snapshot.get('tables', []):
            name = t['name']
            nodes[name] = {
                "node_id": name,
                "table_name": name,
                "row_count": t.get('row_count', 0),
                "column_count": len(t.get('columns', [])),
                "fk_count": len(t.get('foreign_keys', [])),
                "gravity": gravity_store.get(name, 1.0),
                "hub_score": hub_scores.get(name, 0.0),
                "last_interaction": t.get('last_interaction')
            }

        # Detailed Edge State
        edges = {}
        for t in current_snapshot.get('tables', []):
            for fk in t.get('foreign_keys', []):
                target = fk.get('referenced_table', fk.get('target_table'))
                if not target: continue
                edge_id = f"{t.get('name', 'unknown')}_{target}"
                edges[edge_id] = {
                    "source": t.get('name', 'unknown'),
                    "target": target,
                    "type": "foreign_key"
                }

        snapshot_data = {
            "nodes": nodes,
            "edges": edges
        }

        # 3. INSERT
        import json
        is_mysql = db_type == 'mysql'
        is_postgres = db_type in ['postgresql', 'postgres', 'neon', 'neon_db']
        table_path = "evolution.neural_snapshots" if is_postgres else "neural_snapshots"
        
        # MySQL uses %s for params, Postgres uses %s or $1. DBConnector uses %s for both.
        # table_path is a hardcoded constant  not user input, no injection risk.
        sql = f"INSERT INTO {table_path} (connection_id, neural_data, core_metrics) VALUES (%s, %s, %s)"
        try:
            await db_connector.query(connection_id, sql, (connection_id, json.dumps(snapshot_data), json.dumps(metrics)))
            logger.info(f"Neural Core: Snapshot saved for {connection_id} to {table_path}")
        except Exception as e:
            logger.error(f"Failed to save neural snapshot to {table_path}: {e}")

    async def _get_context(self, connection_id: str) -> Dict:
        """Helper to get snapshot for connection, with fallback to schema_analyzer"""
        if not connection_id: return None
        
        # 1. Check local cache
        schema = self.snapshots.get(connection_id)
        if schema: return schema
        
        # 2. Fallback to Schema Analyzer
        try:
            from app.services.schema_analyzer import schema_analyzer
            schema_obj = schema_analyzer.get_analysis_result(connection_id)
            if schema_obj:
                # Convert to dict if model
                schema_dict = schema_obj.dict() if hasattr(schema_obj, 'dict') else schema_obj.model_dump()
                await self.update_schema_context(schema_dict, connection_id) # Cache it
                return schema_dict
        except Exception as e:
            logger.error(f"Neural Core: Context recovery failed for {connection_id}: {e}")
            
        return None

    async def get_core_metrics(self, connection_id: str = None) -> Dict[str, Any]:
        """Return system health and intelligence metrics"""
        conn_id = connection_id or self.active_connection_id
        schema = await self._get_context(conn_id) if conn_id else None
        
        gravity_store = self.gravity_stores.get(conn_id, {})
        patterns = self.patterns_learned.get(conn_id, 0)
        signal_load = self.signal_counts.get(conn_id, 0)
        analyzed = self.analyzed_tables.get(conn_id, set())
        
        unique_targets = set()
        if schema and 'tables' in schema:
            for t in schema['tables']:
                name = t.get('name') if isinstance(t, dict) else getattr(t, 'name', None)
                if name and name != 'Neural Core':
                    unique_targets.add(name)
        
        return {
            "model_state": self.model_state,
            "growth": float(f"{self.growth_factor:.2f}"),
            "patterns": patterns,
            "signal_load": signal_load,
            "avg_gravity": sum(gravity_store.values()) / max(len(gravity_store), 1) if gravity_store else 1.0,
            
            # Status
            "status": self.agent_status,
            "scanned_nodes": len(analyzed),
            "total_nodes": len(unique_targets)
        }

    async def _get_relative_value(self, connection_id: str, table: dict, vitality: float) -> float:
        """
        Query the actual SUM of a financial column from the DB for this table.
        Falls back to vitality  row_count heuristic when no financial column exists.
        """
        from app.services.db_connector import db_connector
        row_count = table.get('row_count', 0)
        cols = table.get('columns', [])
        financial_col = next(
            (c['name'] for c in cols if any(
                t in c['name'].lower()
                for t in ['amount', 'price', 'total', 'revenue', 'value', 'cost', 'balance', 'income']
            )),
            None
        )
        if financial_col:
            try:
                quoted_table = db_connector.quote_identifier(connection_id, table['name'])
                quoted_col = db_connector.quote_identifier(connection_id, financial_col)
                result = await db_connector.query(
                    connection_id, f"SELECT SUM({quoted_col}) as total FROM {quoted_table}"
                )
                if result and result[0].get('total') is not None:
                    return round(float(result[0]['total']), 2)
            except Exception as e:
                logger.debug(f"relative_value query failed for {table.get('name')}: {e}")
        return round(vitality * row_count * 0.001, 2)

    async def trigger_retraining(self, connection_id: str = None):
        """Re-scan the entire schema from scratch for a specific connection"""
        conn_id = connection_id or self.active_connection_id
        if not conn_id: return
        
        logger.info(f"Neural Core: Re-initiating full schema scan for {conn_id}")
        self.agent_status = "RECALCULATING"
        await asyncio.sleep(0.5) # Brief pause for UI feedback
        
        # Reset connection-specific metrics
        self.scan_cursors[conn_id] = 0
        if conn_id in self.analyzed_tables:
            self.analyzed_tables[conn_id].clear()
            
        self.patterns_learned[conn_id] = 0
        self.signal_counts[conn_id] = 0
        
        self.agent_status = "ACTIVE_SCANNING"

    def predict_importance(self, node_id: str, node_type: str = "table") -> float:
        """
        Return the real calculated gravity/importance for a node from the active scan.
        Used by AnalyticsActionHandler.
        """
        # Check gravity store for real calculated weight
        store = self.gravity_stores.get(self.active_connection_id, {})
        if node_id in store:
            return store[node_id]
            
        # Reality-Driven Fallback: Use Authenticated Engine
        from app.services.graph_intelligence import graph_intelligence
        auth = graph_intelligence.get_authenticated_metrics(node_id, 0, 0, 0)
        return auth['gravity']

    async def predict_links(self, connection_id: str, node_id: str, context_nodes: List[str]) -> List[Dict[str, Any]]:
        """
        Identify POTENTIAL relationships based on name similarity.
        """
        schema = await self._get_context(connection_id)
        if not schema: return []
        
        predictions = []
        # Simple heuristic: Name containment
        for other in context_nodes:
            if other == node_id: continue
            
            confidence = 0.0
            reason = ""
            
            # Check if one name contains the other (e.g. "users" in "user_logs")
            # Remove 's' for simple plural check
            root_a = node_id.rstrip('s')
            root_b = other.rstrip('s')
            
            if len(root_a) > 3 and root_a in root_b:
                confidence = 0.75
                reason = f"Semantic match: '{node_id}' appears in '{other}'"
            elif len(root_b) > 3 and root_b in root_a:
                confidence = 0.75
                reason = f"Semantic match: '{other}' appears in '{node_id}'"
            
            if confidence > 0:
                predictions.append({
                    "target_id": other,
                    "relationship": "semantic_inference",
                    "confidence": confidence,
                    "reasoning": reason
                })
                
        return predictions

    async def get_column_intelligence(self, connection_id: str, table_name: str, column_name: str) -> Dict[str, Any]:
        """
        Calculate granular intelligence for a specific column.
        Includes bidirectional impact and propagation paths using formal and semantic links.
        """
        schema = await self._get_context(connection_id)
        if not schema: return {}

        target_table_clean = table_name.lower().strip()
        target_col_clean = column_name.lower().strip()

        # 1. IDENTIFY DIRECT IMPACT (Formal Foreign Keys)
        formal_downstream = []
        formal_upstream = []
        
        current_table_obj = next((t for t in schema.get('tables', []) if t['name'].lower() == target_table_clean), None)
        
        # Find who points TO us (Consumers)
        for t in schema.get('tables', []):
            if t['name'].lower() == target_table_clean: continue
            for fk in t.get('foreign_keys', []):
                if fk.get('referenced_table', fk.get('target_table', '')).lower().strip() == target_table_clean:
                    formal_downstream.append(t['name'])
        
        # Find who WE point to (Origins)
        if current_table_obj:
            for fk in current_table_obj.get('foreign_keys', []):
                formal_upstream.append(fk.get('referenced_table', fk.get('target_table', '')))

        # 2. SEMANTIC BRIDGING (Heuristics for Loose Connections)
        # If we have no formal links, we look for tables that share this column name
        semantic_neighbors = []
        for t in schema.get('tables', []):
            if t['name'].lower() == target_table_clean: continue
            for c in t.get('columns', []):
                if c['name'].lower().strip() == target_col_clean:
                    semantic_neighbors.append(t['name'])

        # 3. WEAVE THE PROPAGATION PATH (The Lifecycle)
        # We build a path: [Origin] -> [Table] -> [Consumer] -> [Hub]
        path_nodes = []
        
        # Determine likely Origin (Upstream)
        origin = "SOURCE"
        if formal_upstream:
            origin = formal_upstream[0]
        elif semantic_neighbors and (target_col_clean.endswith('_id') or target_col_clean.endswith('id')):
            # Improved parent guess: handle film_id -> film, filmid -> film
            parent_guess = target_col_clean.replace('_id', '').replace('id', '')
            for sn in semantic_neighbors:
                if sn.lower() == parent_guess or parent_guess in sn.lower():
                    origin = sn
                    break
        
        path_nodes.append(origin)
        path_nodes.append(table_name)
        
        # Determine likely Consumer (Downstream)
        consumers = []
        visited = {target_table_clean, origin.lower()}
        
        # First use formal dependents
        for ds in formal_downstream:
            if ds.lower() not in visited:
                consumers.append(ds)
                visited.add(ds.lower())
                break # Just pick the primary one for the linear path
                
        # If no formal dependents, use semantic siblings
        if not consumers:
            for sn in semantic_neighbors:
                if sn.lower() not in visited:
                    consumers.append(sn)
                    visited.add(sn.lower())
                    break
                    
        path_nodes.extend(consumers)

        # Find one more hop if possible to reach a "HUB" or "END"
        if consumers:
            last = consumers[-1]
            for t in schema.get('tables', []):
                if t['name'].lower() in visited: continue
                # Is there a bridge from 'last' to 't'?
                linked = False
                for fk in t.get('foreign_keys', []):
                    if fk.get('referenced_table', fk.get('target_table', '')).lower() == last.lower():
                        linked = True
                        break
                if linked:
                    path_nodes.append(t['name'])
                    break
                    
        if len(path_nodes) < 4:
            path_nodes.append("EXIT")

        # 4. PREDICT SIGNATURE STRENGTH
        signature_strength = len(semantic_neighbors)
        
        # INTEGRATE NEURAL CORE (GNN)
        # Use the real importance score to weight the complexity
        try:
            try:
                from backend.ml.graph_neural_core import graph_neural_core
            except ImportError:
                from ml.graph_neural_core import graph_neural_core # type: ignore
            
            # Get table importance (0.0 - 1.0)
            table_importance = graph_neural_core.predict_importance(table_name, "table")
        except Exception as e:
            logger.warning(f"Failed to get GNN importance for {table_name}: {e}")
            table_importance = 0.5 # Default neutral

        # Advanced Complexity Score:
        # Base: Downstream dependencies (high impact)
        # + Semantic reach (potential impact)
        # + Path length (depth of impact)
        # * Multiplied by GNN Importance (Strategic Weight)
        base_complexity = (len(formal_downstream) * 3.0) + (signature_strength * 2.0) + (len(path_nodes) * 1.0)
        neural_complexity = base_complexity * (0.8 + table_importance) # Scale by importance

        return {
            "impact": list(set(formal_downstream + semantic_neighbors)) or ["Isolated System"],
            "propagation_path": path_nodes,
            "signature_strength": signature_strength,
            "complexity_score": neural_complexity,
            "neural_governance": table_importance > 0.7 # Flag if this is a high-value node per GNN
        }

    async def get_bulk_analysis_report(self, connection_id: str) -> Dict[str, Any]:
        """
        Generates a comprehensive report for all nodes in the neural graph.
        Aggregates structural, dynamic, and business metrics.
        """
        schema = await self._get_context(connection_id)
        if not schema:
            return {"status": "error", "message": "No schema context available"}

        # Attempt to get graph intelligence for vitality and performance metrics
        vitality_data = {}
        try:
            from app.services.graph_intelligence import graph_intelligence
            health_report = graph_intelligence.analyze_graph_health(connection_id, {})
            if health_report and "node_stats" in health_report:
                vitality_data = health_report["node_stats"]
        except Exception as e:
            logger.warning(f"Could not fetch graph intelligence for bulk report: {e}")

        report_nodes = []
        for table in schema.get('tables', []):
            table_name = table['name']
            
            # 1. Structural Details
            core_intel = await self.get_column_intelligence(connection_id, table_name, "id")
            
            # 2. Performance & Vitality
            v_stats = vitality_data.get(table_name, {})
            vitality = v_stats.get("vitality", 80) # Default if unknown
            entropy = v_stats.get("entropy", 0.5)
            
            # 3. Sensitivity Classification
            is_sensitive = False
            sensitivity_reason = ""
            
            # Check against WEZU Ontology
            for key, data in self.WEZU_ENERGY_ONTOLOGY.items():
                if key in table_name.lower():
                    is_sensitive = True
                    sensitivity_reason = data["justification"]
                    break
            
            # Check column names for PII/Sensitive markers
            if not is_sensitive:
                sensitive_terms = ["email", "phone", "address", "pass", "key", "token", "ssn", "kyc"]
                for col in table.get('columns', []):
                    cname = col['name'].lower()
                    if any(term in cname for term in sensitive_terms):
                        is_sensitive = True
                        sensitivity_reason = f"Contains sensitive column: {cname}"
                        break

            # 4. Business Metrics  query real financial column SUM when available
            row_count = table.get('row_count', 0)
            relative_value = await self._get_relative_value(connection_id, table, vitality)

            report_nodes.append({
                "id": table_name,
                "name": table_name,
                "metrics": {
                    "gravity": table.get('gravity', 1.0),
                    "complexity": core_intel.get("complexity_score", 0),
                    "vitality": vitality,
                    "entropy": entropy,
                    "row_count": row_count,
                    "relative_value": round(relative_value, 2)
                },
                "classification": {
                    "is_sensitive": is_sensitive,
                    "sensitivity_reason": sensitivity_reason,
                    "governance_flag": core_intel.get("neural_governance", False)
                },
                "impact_reach": core_intel.get("impact", [])
            })

        return {
            "status": "success",
            "connection_id": connection_id,
            "timestamp": datetime.now().isoformat(),
            "nodes": report_nodes,
            "summary": {
                "total_nodes": len(report_nodes),
                "sensitive_nodes": len([n for n in report_nodes if n["classification"]["is_sensitive"]]),
                "high_complexity_nodes": len([n for n in report_nodes if n["metrics"]["complexity"] > 15])
            }
        }


    def get_priority_level(self, gravity: float) -> str:
        """Map gravity score to discrete priority level"""
        if gravity >= 7.0: return "High"
        if gravity >= 4.0: return "Medium"
        return "Low"

    def get_ontology_type(self, table_name: str) -> str:
        """Reverse lookup for table type from ontology"""
        for key, data in self.WEZU_ENERGY_ONTOLOGY.items():
            if key.lower() in table_name.lower():
                return data["type"]
        return "dimension" # Default

    async def get_tables_by_filter(self, connection_id: str, categories: List[str] = None, priority: str = None) -> List[Dict]:
        """Retrieve filtered list of tables with intelligence markers"""
        schema = await self._get_context(connection_id)
        if not schema: return []

        gravity_store = self.gravity_stores.get(connection_id, {})
        results = []

        for table in schema.get('tables', []):
            name = table['name']
            gravity = gravity_store.get(name, self.predict_importance(name))
            p_level = self.get_priority_level(gravity)
            t_type = self.get_ontology_type(name)

            # Apply Priority Filter
            if priority and p_level.lower() != priority.lower():
                continue

            # Apply Category Filter
            if categories and t_type.lower() not in [c.lower() for c in categories]:
                continue

            results.append({
                "name": name,
                "type": t_type,
                "priority": p_level,
                "gravity": round(gravity, 2),
                "row_count": table.get('row_count', 0),
                "importance": round(gravity / 10.0, 2)
            })

        return results


# Global Instance
neural_core = NeuralCore()

# --- Sub-module split documentation ---
# schema_scanner    : update_schema_context (78-153), process_signal (155-241), _analyze_table_intelligence (243-301)
# signal_processor  : save_snapshot (303-403), _get_context (405-425), predict_importance (469-482), predict_links (484-519)
# metrics_calculator: get_core_metrics (427-448), get_column_intelligence (521-653), trigger_retraining (450-467)
# analysis_reporter : get_bulk_analysis_report (655-740), get_priority_level (743-747), get_ontology_type (749-754), get_tables_by_filter (756-787)
# Full split is the next step (Priority 4 sprint work). Core is centralised here for now.
