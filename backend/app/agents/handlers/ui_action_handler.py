from typing import Dict, Any
from .base_handler import ActionHandler

class UIActionHandler(ActionHandler):
    """Handles UI interactions and panel controls."""
    
    async def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if action == "ui.drill_down":
            return await self.drill_down(params)
        elif action == "ui.show_schema":
            return await self.show_schema(params)
        elif action == "ui.sonify":
            return await self.toggle_sonification(params)
            
        return {"success": False, "error": f"Unknown UI action: {action}"}
    
    async def drill_down(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "ui.drill_down",
            "parameters": params,
            "result": {
                "action_type": "ui_navigation",
                "instruction": "drill_down",
                "target": params.get("table_name") or params.get("node_id")
            }
        }

    async def show_schema(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "ui.show_schema",
            "parameters": params,
            "result": {
                "action_type": "ui_navigation",
                "instruction": "show_schema"
            }
        }
        
    async def toggle_sonification(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "ui.sonify",
            "parameters": params,
            "result": {
                "action_type": "ui_audio",
                "instruction": "toggle_sonification"
            }
        }
