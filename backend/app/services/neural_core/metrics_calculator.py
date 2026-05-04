"""
Neural Core  Metrics Calculator
Responsible for: get_core_metrics, trigger_retraining, get_column_intelligence
"""
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
from typing import Dict, Any

logger = logging.getLogger(__name__)
try:
    from backend.app.services.latent_manager import latent_manager
except ImportError:
    try:
        from app.services.latent_manager import latent_manager
    except ImportError:
        latent_manager = None

class NeuralCore:
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
                from backend.ml.graph_neural_core import graph_neural_core # type: ignore
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

