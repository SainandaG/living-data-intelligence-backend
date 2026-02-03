"""
Neural Core Service
-------------------
Implements Active Schema Intelligence.
Instead of simulating training, this core actively scans the connected database schema
to build relationship graphs and calculate complexity metrics in real-time.
"""

import asyncio
from typing import List, Dict, Any
import math
from datetime import datetime, timedelta
try:
    from backend.app.services.latent_manager import latent_manager
except ImportError:
    from app.services.latent_manager import latent_manager

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
        
        # Metrics & Status
        self.growth_factor = 1.0 
        self.agent_status = "IDLE"
        self.active_connection_id = None

    async def initialize(self):
        """Prepare the core for schema analysis"""
        self.model_state = "ready"
        print("Neural Core: Visual Intelligence Engine Ready.")

    def update_schema_context(self, schema: Dict, connection_id: str):
        """Receive the latest schema snapshot to analyze"""
        if not connection_id: return
        
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
            # If connection exists, clear analyzed tables for a fresh scan
            self.analyzed_tables[connection_id].clear()
            self.patterns_learned[connection_id] = 0 # Reset metrics for re-scan
            self.signal_counts[connection_id] = 0
            self.scan_cursors[connection_id] = 0
            
        self.agent_status = "ACTIVE_SCANNING"
            
        # Per-connection Topology
        adj = {}
        in_deg = {}
        out_deg = {}
        
        tables = schema.get('tables', [])
        for t in tables:
            t_name = t['name']
            if t_name not in adj: adj[t_name] = []
            if t_name not in in_deg: in_deg[t_name] = 0
            
            fks = t.get('foreign_keys', [])
            out_deg[t_name] = len(fks)
            
            for fk in fks:
                target = fk.get('referenced_table', fk.get('target_table'))
                if target:
                    if target not in in_deg: in_deg[target] = 0
                    in_deg[target] += 1
        
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

        # OPTIMIZATION: Stop scanning if we are done
        if len(analyzed) >= len(tables):
            # If this is just a heartbeat, do nothing
            if node_id == "heartbeat" and self.agent_status != "ACTIVE_SCANNING":
                self.agent_status = "IDLE (Optimized)" 
                return
            
            # If manual re-calc specifically requested
            if node_id == "manual_recalc":
                analyzed.clear()
                self.patterns_learned[conn_id] = 0 # Reset metrics for re-scan
                self.signal_counts[conn_id] = 0
                self.scan_cursors[conn_id] = 0
                self.agent_status = "ACTIVE_SCANNING"
            elif node_id == "heartbeat":
                # Fallback: if we were stuck in active but done, idle now
                self.agent_status = "IDLE (Optimized)"
                return

        # Active Scanning Logic (1 tick = 1 table analysis step)
        current_idx = cursor % len(tables)
        target_table = tables[current_idx]
        t_name = target_table['name']
        
        if t_name not in analyzed:
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

            # Weighted Sigmoid Importance
            row_count = target_table.get('row_count', 0) or 1
            row_factor = math.log10(max(1, row_count)) * 0.4
            col_factor = cols * 0.1
            
            raw_imp = row_factor + (norm_struct * 6.0) + col_factor
            sigmoid_imp = 1 / (1 + math.exp(-(raw_imp - 4.0)))
            base_gravity = 1.0 + (sigmoid_imp * 4.0)

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
                except: pass

            self.gravity_stores[conn_id][t_name] = final_gravity
            analyzed.add(t_name)
            self.analyzed_tables[conn_id] = analyzed

        # Update global growth factor based on total connection knowledge
        total_complexity = sum(self.patterns_learned.values()) + (sum(self.signal_counts.values()) * 0.1)
        self.growth_factor = 1.0 + math.log10(max(1, total_complexity))

        # Advance Cursor
        self.scan_cursors[conn_id] = cursor + 1
        self.agent_status = "COMPUTING_CENTRALITY" if cursor % 2 == 0 else "SIGMOID_GRAVITY_SYNC"

        # AUTO-SAVE: If we just finished a full scan cycle
        if len(analyzed) == len(tables) and self.scan_cursors[conn_id] % len(tables) == 0:
            # Trigger Latent Space Update
            # Extract basic node/edge structure for the GNN
            gnn_nodes = [{"id": t['name'], "metadata": t} for t in tables]
            gnn_edges = []
            for t in tables:
                for fk in t.get('foreign_keys', []):
                    if fk.get('target_table'):
                        gnn_edges.append({"source": t['name'], "target": fk['target_table']})
            
            # Fire and forget (or await if async)
            # Since update_latent_space is CPU bound (numpy/sklearn), ideally we offload or run it here.
            # It has its own lock, so it's thread-safe.
            try:
                latent_manager.update_latent_space(gnn_nodes, gnn_edges)
            except Exception as e:
                print(f"Neural Core: Failed to update Latent Space: {e}")

            print(f"🧠 Neural Core: Completed full sync for {conn_id}. Persisting state...")
            asyncio.create_task(self.save_snapshot(conn_id))

    async def save_snapshot(self, connection_id: str):
        """Persist the current neural state to the database"""
        current_snapshot = self.snapshots.get(connection_id)
        if not current_snapshot: 
            print("Neural Core: No schema snapshot to save.")
            return
        
        from app.services.db_connector import db_connector
        print(f"Neural Core: Initiating snapshot save for {connection_id}...")
        
        # 1. Create table if not exists (Lazy Init - Dialect Aware)
        try:
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info['type']
            
            if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                await db_connector.query(connection_id, """
                    CREATE SCHEMA IF NOT EXISTS evolution;
                    CREATE TABLE IF NOT EXISTS evolution.neural_snapshots (
                        id SERIAL PRIMARY KEY,
                        connection_id TEXT NOT NULL,
                        snapshot_at TIMESTAMPTZ DEFAULT NOW(),
                        neural_data JSONB,
                        core_metrics JSONB
                    );
                """)
                await db_connector.query(connection_id, "CREATE INDEX IF NOT EXISTS idx_neural_conn ON evolution.neural_snapshots(connection_id)")
            elif db_type == 'mysql':
                # MySQL doesn't have schemas in the same way, usually it's just the database name.
                # But if we want to mimic the 'evolution' namespace, we can use a prefix or a separate DB.
                # For simplicity in this platform, we'll just use a 'neural_snapshots' table.
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
        except Exception as e:
            print(f"FAIL: Failed to init neural_snapshots table: {e}")
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
                edge_id = f"{t['name']}_{target}"
                edges[edge_id] = {
                    "source": t['name'],
                    "target": target,
                    "type": "foreign_key"
                }

        snapshot_data = {
            "nodes": nodes,
            "edges": edges
        }

        # 3. INSERT
        import json
        table_name = "evolution.neural_snapshots" if db_type != 'mysql' else "neural_snapshots"
        sql = f"INSERT INTO {table_name} (connection_id, neural_data, core_metrics) VALUES (%s, %s, %s)"
        try:
            await db_connector.query(connection_id, sql, (connection_id, json.dumps(snapshot_data), json.dumps(metrics)))
            print(f"Neural Core: Snapshot saved for {connection_id} to {table_name}.")
        except Exception as e:
            print(f"FAIL: Failed to save neural snapshot to {table_name}: {e}")

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
                self.update_schema_context(schema_dict, connection_id) # Cache it
                return schema_dict
        except Exception as e:
            print(f"Neural Core: Context recovery failed for {connection_id}: {e}")
            
        return None

    async def get_core_metrics(self, connection_id: str = None) -> Dict[str, Any]:
        """Return system health and intelligence metrics"""
        conn_id = connection_id or self.active_connection_id
        schema = await self._get_context(conn_id) if conn_id else None
        
        gravity_store = self.gravity_stores.get(conn_id, {})
        patterns = self.patterns_learned.get(conn_id, 0)
        signal_load = self.signal_counts.get(conn_id, 0)
        analyzed = self.analyzed_tables.get(conn_id, set())
        
        return {
            "model_state": self.model_state,
            "growth": float(f"{self.growth_factor:.2f}"),
            "patterns": patterns,
            "signal_load": signal_load,
            "avg_gravity": sum(gravity_store.values()) / max(len(gravity_store), 1) if gravity_store else 1.0,
            
            # Status
            "status": self.agent_status,
            "scanned_nodes": len(analyzed),
            "total_nodes": len(schema['tables']) if schema and 'tables' in schema else 0
        }

    async def trigger_retraining(self, connection_id: str = None):
        """Re-scan the entire schema from scratch for a specific connection"""
        conn_id = connection_id or self.active_connection_id
        if not conn_id: return
        
        print(f"Neural Core: Re-initiating full schema scan for {conn_id}...")
        self.agent_status = "RECALCULATING"
        await asyncio.sleep(0.5) # Brief pause for UI feedback
        
        # Reset connection-specific metrics
        self.scan_cursors[conn_id] = 0
        if conn_id in self.analyzed_tables:
            self.analyzed_tables[conn_id].clear()
            
        self.patterns_learned[conn_id] = 0
        self.signal_counts[conn_id] = 0
        
        self.agent_status = "ACTIVE_SCANNING"

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
                        linked = True; break
                if linked:
                    path_nodes.append(t['name'])
                    break
                    
        if len(path_nodes) < 4:
            path_nodes.append("EXIT")

        # 4. PREDICT SIGNATURE STRENGTH
        signature_strength = len(semantic_neighbors)

        return {
            "impact": list(set(formal_downstream + semantic_neighbors)) or ["Isolated System"],
            "propagation_path": path_nodes,
            "signature_strength": signature_strength,
            "complexity_score": (len(formal_downstream) * 3.0) + (signature_strength * 2.0) + (len(path_nodes) * 1.0)
        }

# Global Instance
neural_core = NeuralCore()
