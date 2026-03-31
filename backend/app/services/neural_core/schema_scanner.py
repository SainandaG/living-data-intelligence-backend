"""
Neural Core — Schema Scanner
Responsible for: update_schema_context, process_signal, _analyze_table_intelligence
"""
"""Neural Core – main module. Imports all sub-module method groups."""
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
from datetime import datetime, timedelta
from functools import lru_cache
import time

logger = logging.getLogger(__name__)
try:
    from backend.app.services.latent_manager import latent_manager
except ImportError:
    try:
        from app.services.latent_manager import latent_manager
    except ImportError:
        latent_manager = None

class NeuralCore:
    async def update_schema_context(self, schema: Dict, connection_id: str, edges: List[Dict] = None):
        """
        Receive the latest schema/graph snapshot to analyze.
        Updated to support both full Schema objects and raw Graph nodes+edges.
        """
        if not connection_id: return
        
        from app.services.generation_log_service import generation_log_service
        await generation_log_service.log_step(connection_id, "📡 Neural Core: Signal received - Updating schema context", progress=10)
        
        # [PHASE 3] Cooldown Check (5 seconds)
        # Hot-fix for attribute persistence during reload
        if not hasattr(self, 'last_analysis_time'):
            self.last_analysis_time = {}

        current_time = time.time()
        last_time = self.last_analysis_time.get(connection_id, 0)
        if current_time - last_time < 5.0:
            return 
            
        self.last_analysis_time[connection_id] = current_time
        
        self.snapshots[connection_id] = schema
        self.active_connection_id = connection_id
            
        # Initialize connection-specific metrics if not present
        if connection_id not in self.analyzed_tables:
            await generation_log_service.log_step(connection_id, "🆕 Initializing intelligence buffers for new session", progress=15)
            self.analyzed_tables[connection_id] = set()
            self.gravity_stores[connection_id] = {}
            self.hub_scores[connection_id] = {}
            self.patterns_learned[connection_id] = 0
            self.signal_counts[connection_id] = 0
            self.scan_cursors[connection_id] = 0
        else:
            await generation_log_service.log_step(connection_id, "🔄 Context Refresh: Re-scanning table complexity", progress=20)
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
            await self._analyze_table_intelligence(target_table, conn_id, analyzed)

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
        
        if (now - last_save) > 60 and len(analyzed) >= len(tables):
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
        auth_metrics = graph_intelligence.get_authenticated_metrics(
            t_name, 
            target_table.get('row_count', 0),
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
                pass  # Malformed timestamp — skip decay, use base gravity

        self.gravity_stores[conn_id][t_name] = final_gravity
        analyzed_set.add(t_name)
        self.analyzed_tables[conn_id] = analyzed_set
