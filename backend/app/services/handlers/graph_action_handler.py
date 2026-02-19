from typing import Dict, Any
from .base_handler import ActionHandler

class GraphActionHandler(ActionHandler):
    """Handles 3D graph visualizations and interactions."""
    
    async def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if action == "graph.highlight":
            return await self.highlight_node(params)
        elif action == "graph.zoom_cluster":
            return await self.zoom_cluster(params)
        elif action == "graph.reset_view":
            return await self.reset_view(params)
        elif action == "graph.trace_lineage":
            return await self.trace_lineage(params)
        elif action == "graph.recalculate_gravity":
            return await self.recalculate_gravity(params)
        
        return {"success": False, "error": f"Unknown graph action: {action}"}
    
    async def highlight_node(self, params: Dict[str, Any]):
        return {
            "success": True,
            "action": "graph.highlight",
            "parameters": params,
            "result": {
                "action_type": "graph_highlight",
                "instruction": "highlight_node",
                "target": params.get("table_name")
            }
        }

    async def zoom_cluster(self, params: Dict[str, Any]):
        return {
            "success": True,
            "action": "graph.zoom_cluster",
            "parameters": params,
            "result": {
                "action_type": "graph_zoom",
                "instruction": "zoom_cluster",
                "target": params.get("cluster_name")
            }
        }

    async def reset_view(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "graph.reset_view",
            "parameters": params,
            "result": {
                "action_type": "graph_camera",
                "instruction": "reset_view"
            }
        }
        
    async def trace_lineage(self, params: Dict[str, Any]):
        # Real lineage tracing via schema foreign key relationships
        target = params.get("table_name")
        connection_id = params.get("connection_id")
        lineage_nodes = [target]
        
        if connection_id:
            try:
                from app.services.schema_analyzer import schema_analyzer
                schema = schema_analyzer.get_analysis_result(connection_id)
                if schema:
                    tables = schema.tables if hasattr(schema, 'tables') else schema.get('tables', [])
                    for table in tables:
                        t_name = getattr(table, 'name', table.get('name', ''))
                        fks = getattr(table, 'foreign_keys', table.get('foreign_keys', []))
                        for fk in fks:
                            ref_table = fk.get('references_table', fk.get('to_table', ''))
                            # Upstream: tables that reference target
                            if ref_table and ref_table.lower() == target.lower() and t_name not in lineage_nodes:
                                lineage_nodes.append(t_name)
                            # Downstream: tables that target references
                            if t_name.lower() == target.lower() and ref_table and ref_table not in lineage_nodes:
                                lineage_nodes.append(ref_table)
            except Exception as e:
                pass  # Fall back to just the target node
        
        return {
            "success": True, 
            "action": "graph.trace_lineage",
            "parameters": params,
            "result": {
                "action_type": "graph_trace_lineage",
                "target": target,
                "lineage_nodes": lineage_nodes
            }
        }
    
    async def recalculate_gravity(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "graph.recalculate_gravity",
            "parameters": params,
            "result": {
                "action_type": "analytics", # Assuming handled by analytics or special handler
                "instruction": "apply_clustering" # Similar to optimize
            }
        }
