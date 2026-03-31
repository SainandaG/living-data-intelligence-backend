from typing import Dict, Any
from .base_handler import ActionHandler

class DataflowActionHandler(ActionHandler):
    """Handles data flow simulations, evolution, and path highlighting."""
    
    async def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if action == "graph.start_evolution":
            return await self.start_evolution(params)
        elif action == "graph.stop_evolution":
            return await self.stop_evolution(params)
        elif action == "graph.simulate_formation":
            return await self.simulate_formation(params)
        elif action == "graph.start_flow":
            return await self.start_flow(params)
        elif action == "graph.stop_flow":
            return await self.stop_flow(params)
        elif action == "graph.highlight_path":
            return await self.highlight_path(params)
        elif action == "graph.set_flow_speed":
            return await self.set_speed(params)
            
        return {"success": False, "error": f"Unknown dataflow action: {action}"}
    
    async def start_flow(self, params: Dict[str, Any]):
        nodes = params.get("nodes", [])
        if not nodes and params.get("table_name"):
            nodes = [params.get("table_name")]
            
        return {
            "success": True, 
            "action": "graph.start_flow",
            "parameters": params,
            "result": {
                "action_type": "graph_flow",
                "instruction": "start_flow",
                "nodes": nodes,
                "target": params.get("table_name"),
                "message": "Data flow visualization active"
            }
        }
        
    async def stop_flow(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "graph.stop_flow",
            "parameters": params,
            "result": {
                "action_type": "graph_flow",
                "instruction": "stop_flow",
                "message": "Data flow visualization stopped"
            }
        }

    async def highlight_path(self, params: Dict[str, Any]):
        return {
            "success": True,
            "action": "graph.highlight_path",
            "parameters": params,
            "result": {
                "action_type": "graph_highlight",
                "instruction": "highlight_path",
                "path": params.get("path", []),
                "color": params.get("color", "#00ff00")
            }
        }

    async def set_speed(self, params: Dict[str, Any]):
        return {
            "success": True,
            "action": "graph.set_flow_speed",
            "result": {
                "action_type": "graph_flow_control",
                "instruction": "set_speed",
                "value": params.get("value", 1.0)
            }
        }
    
    async def start_evolution(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "graph.start_evolution",
            "parameters": params,
            "result": {
                "action_type": "graph_evolution",
                "instruction": "start_evolution"
            }
        }

    async def stop_evolution(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "graph.stop_evolution",
            "parameters": params,
            "result": {
                "action_type": "graph_evolution",
                "instruction": "stop_evolution"
            }
        }
        
    async def simulate_formation(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "graph.simulate_formation",
            "parameters": params,
            "result": {
                "action_type": "graph_evolution",
                "instruction": "simulate_formation"
            }
        }
