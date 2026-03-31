"""
Neural Core — Signal Processor
Responsible for: save_snapshot, _get_context, predict_importance, predict_links
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
    async def save_snapshot(self, connection_id: str):
        """Persist the current neural state to the database"""
        from app.services.generation_log_service import generation_log_service
        current_snapshot = self.snapshots.get(connection_id)
        if not current_snapshot: 
            logger.warning("Neural Core: No schema snapshot to save.")
            return
        
        from app.services.db_connector import db_connector
        await generation_log_service.log_step(connection_id, "💾 Persisting Neural State to evolution.neural_snapshots", progress=90)
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
        except Exception as e:
            logger.error(f"Failed to init neural_snapshots table: {e}")
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
        is_mysql = db_type == 'mysql'
        table_path = "evolution.neural_snapshots" if not is_mysql else "neural_snapshots"
        
        # MySQL uses %s for params, Postgres uses %s or $1. DBConnector uses %s for both.
        sql = "INSERT INTO " + table_path + " (connection_id, neural_data, core_metrics) VALUES (%s, %s, %s)"  # table_path is hardcoded
        try:
            await db_connector.query(connection_id, sql, (connection_id, json.dumps(snapshot_data), json.dumps(metrics)))
            logger.info(f"Neural Core: Snapshot saved for {connection_id} to {table_path}")
            await generation_log_service.log_step(connection_id, "✅ Neural State persisted successfully", level="success", progress=100)
        except Exception as e:
            logger.error(f"Failed to save neural snapshot to {table_path}: {e}")
            await generation_log_service.log_step(connection_id, f"⚠️ Snapshot save failed: {e}", level="warning", progress=100)
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
