"""
Neural Core  Analysis Reporter
Responsible for: get_bulk_analysis_report, get_priority_level, get_ontology_type, get_tables_by_filter
"""
"""Neural Core  main module. Imports all sub-module method groups."""
"""
Neural Core Service
-------------------
Implements Active Schema Intelligence.
Instead of simulating training, this core actively scans the connected database schema
to build relationship graphs and calculate complexity metrics in real-time.
"""

import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)
try:
    from backend.app.services.latent_manager import latent_manager
except ImportError:
    try:
        from app.services.latent_manager import latent_manager
    except ImportError:
        latent_manager = None

class NeuralCore:
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
            health_report = await graph_intelligence.analyze_graph_health(connection_id)
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

