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

class NeuralCore:
    def __init__(self):
        self.model_state = "initializing"
        
        # Intelligence Metrics (Deterministic)
        self.patterns_learned = 0 
        self.signal_count = 0 
        self.growth_factor = 1.0 
        
        # Graph Structural Data
        self.adjacency_map = {} # node -> [neighbors]
        self.in_degree = {} # node -> count
        self.out_degree = {} # node -> count
        self.hub_scores = {} # node -> centrality
        
        # Scanning State
        self.schema_snapshot = None
        self.scan_cursor = 0 # Index of current table being analyzed
        self.analyzed_tables = set()
        
        # Insights
        self.gravity_store = {} # node_id -> importance_score
        self.agent_status = "IDLE"

    async def initialize(self):
        """Prepare the core for schema analysis"""
        self.model_state = "ready"
        print("Neural Core: Visual Intelligence Engine Ready.")

    def update_schema_context(self, schema: Dict):
        """Receive the latest schema snapshot to analyze"""
        self.schema_snapshot = schema
        # Reset if new schema
        if not self.analyzed_tables:
            self.agent_status = "ACTIVE_SCANNING"
            
        # Global Topology Analysis (Pre-calc)
        self.adjacency_map = {}
        self.in_degree = {} 
        self.out_degree = {}
        
        tables = schema.get('tables', [])
        for t in tables:
            t_name = t['name']
            if t_name not in self.adjacency_map: self.adjacency_map[t_name] = []
            if t_name not in self.in_degree: self.in_degree[t_name] = 0
            if t_name not in self.out_degree: self.out_degree[t_name] = len(t.get('foreign_keys', []))
            
            for fk in t.get('foreign_keys', []):
                target = fk.get('target_table')
                if target:
                    if target not in self.in_degree: self.in_degree[target] = 0
                    self.in_degree[target] += 1

    async def process_signal(self, node_id: str, intensity: float, metadata: Dict = None):
        """
        Advance the analysis cursor. 
        Each 'signal' (tick) processes the next part of the real schema.
        """
        if not self.schema_snapshot or not self.schema_snapshot.get('tables'):
            return

        tables = self.schema_snapshot['tables']
        if not tables: return

        # OPTIMIZATION: Stop scanning if we are done
        if len(self.analyzed_tables) >= len(tables):
            # If this is just a heartbeat, do nothing
            if node_id == "heartbeat" and self.agent_status != "ACTIVE_SCANNING":
                self.agent_status = "IDLE (Optimized)" 
                return
            
            # If manual re-calc specifically requested
            if node_id == "manual_recalc" and self.agent_status != "ACTIVE_SCANNING":
                self.analyzed_tables.clear()
                self.patterns_learned = 0 # Reset metrics for re-scan
                self.agent_status = "ACTIVE_SCANNING"
            elif node_id == "heartbeat":
                # Fallback: if we were stuck in active but done, idle now
                self.agent_status = "IDLE (Optimized)"
                return

        # Active Scanning Logic (1 tick = 1 table analysis step)
        current_idx = self.scan_cursor % len(tables)
        target_table = tables[current_idx]
        
        # Analyze this real table
        if target_table['name'] not in self.analyzed_tables:
            # 1. Calculate Patterns (Foreign Keys)
            fks = len(target_table.get('foreign_keys', []))
            self.patterns_learned += fks
            
            # 2. Update Signal Load (Columns)
            cols = len(target_table.get('columns', []))
            self.signal_count += cols
            
            # 3. Calculate Weight/Gravity (Advanced)
            # Fetch Centrality
            in_deg = self.in_degree.get(target_table['name'], 0)
            out_deg = self.out_degree.get(target_table['name'], 0)
            
            # Structural Centrality Score (normalized approx 0-1)
            struct_centrality = (in_deg * 1.5) + (out_deg * 0.5)
            norm_struct = min(1.0, struct_centrality / 10.0)
            self.hub_scores[target_table['name']] = norm_struct

            # Weighted Sigmoid Importance
            # Inputs: Row Count (Log), Structural Score, Column Count
            row_factor = math.log10(max(1, target_table.get('row_count', 0) or 1)) * 0.3
            col_factor = cols * 0.05
            
            raw_imp = row_factor + (norm_struct * 5.0) + col_factor
            # Sigmoid with offset to center interesting nodes
            sigmoid_imp = 1 / (1 + math.exp(-(raw_imp - 3.0)))
            base_gravity = 1.0 + (sigmoid_imp * 4.0)

            # 4. Interaction Simulation (Liveness)
            # Default "last active" if missing, based on size (larger tables imply more generic activity)
            last_interaction = target_table.get('last_interaction')
            if not last_interaction:
                # Simulate activity: bigger tables = more recent
                days_ago = max(0, 30 - math.log(max(1, target_table.get('row_count', 0))))
                last_interaction = (datetime.now() - timedelta(days=days_ago)).isoformat()
                # Update back to source (optional, but good for consistency)
                target_table['last_interaction'] = last_interaction

            # Calculate Time Decay
            try:
                dt = datetime.fromisoformat(str(last_interaction).replace('Z', '+00:00'))
                # Handle offset-naive vs aware
                if dt.tzinfo is None:
                    now = datetime.now()
                else:
                    now = datetime.now().astimezone()
                
                hours_since = (now - dt).total_seconds() / 3600
                # Decay: Full strength at 0 hours, 50% at 24 hours
                decay_factor = 1.0 / (1.0 + (hours_since / 24.0)) 
                
                # Apply decay but keep a static floor (don't let important nodes vanish)
                final_gravity = (base_gravity * 0.4) + (base_gravity * 0.6 * decay_factor)
                
            except Exception:
                final_gravity = base_gravity

            self.gravity_store[target_table['name']] = final_gravity
            
            self.analyzed_tables.add(target_table['name'])
            
            # Log for debug visibility
            # print(f"🧠 Neural Core: Analyzed {target_table['name']} | Complexity: {complexity:.2f}")

        # Update Growth Factor (Global Complexity)
        # Logarithmic scale of total knowledge
        total_complexity = self.patterns_learned + (self.signal_count * 0.1)
        self.growth_factor = 1.0 + math.log10(max(1, total_complexity))

        # Advance Cursor
        self.scan_cursor += 1
        self.agent_status = "ANALYZING_RELATIONSHIPS" if self.scan_cursor % 2 == 0 else "COMPUTING_GRAVITY"

        # AUTO-SAVE: If we just finished a full scan cycle, persist to DB
        if len(self.analyzed_tables) == len(tables) and self.scan_cursor % len(tables) == 0:
            asyncio.create_task(self.save_snapshot(node_id)) # node_id here is connection_id in the API flux

    async def save_snapshot(self, connection_id: str):
        """Persist the current neural state to the database"""
        if not self.schema_snapshot: 
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
        metrics = self.get_core_metrics()
        
        # Detailed Node State
        nodes = {}
        for t in self.schema_snapshot.get('tables', []):
            name = t['name']
            nodes[name] = {
                "node_id": name,
                "table_name": name,
                "row_count": t.get('row_count', 0),
                "column_count": len(t.get('columns', [])),
                "fk_count": len(t.get('foreign_keys', [])),
                "gravity": self.gravity_store.get(name, 1.0),
                "hub_score": self.hub_scores.get(name, 0.0),
                "last_interaction": t.get('last_interaction')
            }

        # Detailed Edge State
        edges = {}
        for t in self.schema_snapshot.get('tables', []):
            for fk in t.get('foreign_keys', []):
                target = fk.get('target_table')
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

    def get_core_metrics(self) -> Dict[str, Any]:
        """Return the current DETERMINISTIC state of intelligence"""
        return {
            "growth": float(f"{self.growth_factor:.2f}"),
            "patterns": self.patterns_learned,
            "signal_load": self.signal_count,
            "avg_gravity": sum(self.gravity_store.values()) / max(len(self.gravity_store), 1) if self.gravity_store else 1.0,
            
            # Status
            "status": self.agent_status,
            "scanned_nodes": len(self.analyzed_tables),
            "total_nodes": len(self.schema_snapshot['tables']) if self.schema_snapshot else 0
        }

    async def trigger_retraining(self):
        """Re-scan the entire schema from scratch"""
        print("Neural Core: Re-initiating full schema scan...")
        self.agent_status = "RECALCULATING"
        await asyncio.sleep(1) # Brief pause for UI feedback
        
        # Reset but keep gravity cache for stability
        self.scan_cursor = 0
        self.analyzed_tables.clear()
        self.patterns_learned = 0
        self.signal_count = 0
        self.growth_factor = 1.0
        
        self.agent_status = "ACTIVE_SCANNING"

    async def predict_links(self, node_id: str, context_nodes: List[str]) -> List[Dict[str, Any]]:
        """
        Identify POTENTIAL relationships based on name similarity.
        (e.g. table "user_logs" might relate to "users" even if no FK exists)
        """
        if not self.schema_snapshot: return []
        
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

# Global Instance
neural_core = NeuralCore()
