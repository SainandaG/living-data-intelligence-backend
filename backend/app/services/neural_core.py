import asyncio
import math
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict

@dataclass
class StateDelta:
    """An immutable record of system intelligence at a specific point in time."""
    timestamp: str
    connection_id: str
    patterns_learned: int
    signal_count: int
    growth_factor: float
    avg_gravity: float
    scanned_nodes: int
    total_nodes: int
    node_states: Dict[str, Dict[str, Any]]
    edge_states: Dict[str, Dict[str, Any]]
    prev_state_id: Optional[int] = None

class NeuralCore:
    """
    Neural Core - Reality-Driven Evolution Engine
    Implements a chain of immutable intelligence states derived from live data.
    """
    def __init__(self):
        self.model_state = "initializing"
        
        # Current Transient Buffer (to be pushed into StateDelta)
        self.patterns_learned = 0 
        self.signal_count = 0 
        self.growth_factor = 1.0 
        
        # Topology Cache
        self.adjacency_map = {}
        self.in_degree = {}
        self.out_degree = {}
        self.hub_scores = {}
        self.gravity_store = {}
        
        # Scanning State
        self.schema_snapshot = None
        self.scan_cursor = 0
        self.analyzed_tables = set()
        
        # State History (Last N states for motion derivation)
        self.state_history: List[StateDelta] = []
        self.last_saved_id: Optional[int] = None
        self.agent_status = "IDLE"
        self.last_metrics = {}

    async def initialize(self):
        self.model_state = "ready"
        print("Neural Core: Reality-Driven Intelligence Engine Activated.")

    def update_schema_context(self, schema: Dict):
        """Seed the system with a raw reality snapshot."""
        if not schema: return
        self.schema_snapshot = schema
        
        # Reset tracking for new reality
        self.analyzed_tables.clear()
        self.scan_cursor = 0
        self.agent_status = "ACTIVE_SCANNING"
            
        # Global Topology Analysis
        self._calculate_topology()

    def _calculate_topology(self):
        self.adjacency_map = {}
        self.in_degree = {} 
        self.out_degree = {}
        
        tables = self.schema_snapshot.get('tables', [])
        for t in tables:
            t_name = t['name']
            self.adjacency_map[t_name] = []
            self.in_degree[t_name] = self.in_degree.get(t_name, 0)
            self.out_degree[t_name] = len(t.get('foreign_keys', []))
            
            for fk in t.get('foreign_keys', []):
                target = fk.get('target_table')
                if target:
                    self.in_degree[target] = self.in_degree.get(target, 0) + 1

    async def process_signal(self, node_id: str, intensity: float, metadata: Dict = None):
        """Advance the scanning cursor and emit a new state delta."""
        if not self.schema_snapshot or not self.schema_snapshot.get('tables'):
            return

        tables = self.schema_snapshot['tables']
        if not tables: return

        # Progress through reality
        current_idx = self.scan_cursor % len(tables)
        target_table = tables[current_idx]
        
        # Analyze current table context
        if target_table['name'] not in self.analyzed_tables:
            self._analyze_table_node(target_table)
            self.analyzed_tables.add(target_table['name'])

        # Update global growth
        total_complexity = self.patterns_learned + (self.signal_count * 0.1)
        self.growth_factor = 1.0 + math.log10(max(1, total_complexity))

        # Emit New Immutable State
        if self.scan_cursor % 5 == 0: # Emit state every 5 ticks to avoid overhead
            await self._emit_state(node_id) # connection_id

        self.scan_cursor += 1
        self.agent_status = "ANALYZING" if len(self.analyzed_tables) < len(tables) else "IDLE (Optimized)"

    def _analyze_table_node(self, target_table: Dict):
        name = target_table['name']
        fks = len(target_table.get('foreign_keys', []))
        self.patterns_learned += fks
        
        cols = len(target_table.get('columns', []))
        self.signal_count += cols
        
        in_deg = self.in_degree.get(name, 0)
        out_deg = self.out_degree.get(name, 0)
        
        struct_centrality = (in_deg * 1.5) + (out_deg * 0.5)
        norm_struct = min(1.0, struct_centrality / 10.0)
        self.hub_scores[name] = norm_struct

        row_factor = math.log10(max(1, target_table.get('row_count', 0) or 1)) * 0.3
        col_factor = cols * 0.05
        
        raw_imp = row_factor + (norm_struct * 5.0) + col_factor
        sigmoid_imp = 1 / (1 + math.exp(-(raw_imp - 3.0)))
        self.gravity_store[name] = 1.0 + (sigmoid_imp * 4.0)

    async def _emit_state(self, connection_id: str):
        """Create and persist a new state delta."""
        # Avoid persisting transient signals
        if connection_id in ["heartbeat", "manual_recalc", "agent_signal", "schema_scan"]: 
            return 
        
        node_states = {}
        for t in self.schema_snapshot.get('tables', []):
            name = t['name']
            node_states[name] = {
                "gravity": self.gravity_store.get(name, 1.0),
                "hub_score": self.hub_scores.get(name, 0.0),
                "vitality": 50 + (self.hub_scores.get(name, 0.0) * 50) # Derived
            }

        delta = StateDelta(
            timestamp=datetime.now().isoformat(),
            connection_id=connection_id,
            patterns_learned=self.patterns_learned,
            signal_count=self.signal_count,
            growth_factor=float(f"{self.growth_factor:.2f}"),
            avg_gravity=sum(self.gravity_store.values()) / max(len(self.gravity_store), 1) if self.gravity_store else 1.0,
            scanned_nodes=len(self.analyzed_tables),
            total_nodes=len(self.schema_snapshot['tables']) if self.schema_snapshot else 0,
            node_states=node_states,
            edge_states={}, # To be refined in data-flow phase
            prev_state_id=self.last_saved_id
        )

        self.state_history.append(delta)
        if len(self.state_history) > 50: self.state_history.pop(0)

        # Persistence
        await self.save_snapshot(connection_id, delta)
        self.last_metrics = delta.node_states

    async def predict_links(self, table_name: str, valid_targets: List[str]) -> List[Dict[str, Any]]:
        """
        AI-Predicted Link Generation (Reality-Driven Context)
        Uses structural similarity and importance weighting.
        """
        predictions = []
        if not self.schema_snapshot: return []
        
        # Simple heuristic: Similar importance and structural affinity
        src_imp = self.gravity_store.get(table_name, 1.0)
        
        for target in valid_targets:
            if target == table_name: continue
            tgt_imp = self.gravity_store.get(target, 1.0)
            
            # Predict link if both are high-gravity (Semantic Hub Relationship)
            if src_imp > 3.0 and tgt_imp > 3.0:
                predictions.append({
                    'target_id': target,
                    'confidence': 0.85,
                    'reasoning': "High-Gravity Semantic Hub Relationship"
                })
        return predictions

    async def save_snapshot(self, connection_id: str, delta: StateDelta = None):
        """Persist state delta to evolution.neural_snapshots."""
        if not delta: 
            if not self.state_history: return
            delta = self.state_history[-1]
            
        from app.services.db_connector import db_connector
        
        try:
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info['type']
            
            # Ensure schema/table exists
            if db_type in ['postgresql', 'postgres']:
                await db_connector.query(connection_id, """
                    CREATE SCHEMA IF NOT EXISTS evolution;
                    CREATE TABLE IF NOT EXISTS evolution.neural_snapshots (
                        id SERIAL PRIMARY KEY,
                        connection_id TEXT NOT NULL,
                        snapshot_at TIMESTAMPTZ DEFAULT NOW(),
                        neural_data JSONB,
                        core_metrics JSONB,
                        prev_state_id INTEGER
                    );
                """)
            
            # Insert Delta
            import json
            sql = "INSERT INTO evolution.neural_snapshots (connection_id, neural_data, core_metrics, prev_state_id) VALUES (%s, %s, %s, %s) RETURNING id"
            res = await db_connector.query(connection_id, sql, (
                connection_id, 
                json.dumps({"nodes": delta.node_states}), 
                json.dumps({
                    "growth": delta.growth_factor,
                    "patterns": delta.patterns_learned,
                    "signal_load": delta.signal_count
                }),
                delta.prev_state_id
            ))
            
            if res:
                self.last_saved_id = res[0]['id']
                
        except Exception as e:
            print(f"Neural Core: Persistence failure: {e}")

    def get_core_metrics(self) -> Dict[str, Any]:
        """Return metrics from the latest emitted state."""
        if not self.state_history:
            return {
                "growth": self.growth_factor,
                "patterns": self.patterns_learned,
                "signal_load": self.signal_count,
                "status": self.agent_status
            }
        
        last = self.state_history[-1]
        return {
            "growth": last.growth_factor,
            "patterns": last.patterns_learned,
            "signal_load": last.signal_count,
            "avg_gravity": float(f"{last.avg_gravity:.2f}"),
            "status": self.agent_status,
            "scanned_nodes": last.scanned_nodes,
            "total_nodes": last.total_nodes
        }

    async def get_motion_delta(self, node_id: str) -> Dict[str, float]:
        """Derive velocity between the last two states for a node."""
        if len(self.state_history) < 2:
            return {"velocity": 0.0, "acceleration": 0.0}
        
        curr = self.state_history[-1].node_states.get(node_id, {})
        prev = self.state_history[-2].node_states.get(node_id, {})
        
        v = curr.get('gravity', 0) - prev.get('gravity', 0)
        return {"velocity": v}

# Global Instance
neural_core = NeuralCore()
