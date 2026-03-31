import logging
from typing import Dict, Any
from ...services.neural_core import NeuralCore
from .base_handler import ActionHandler

logger = logging.getLogger(__name__)

class AnalyticsActionHandler(ActionHandler):
    """Handles data analytics, anomalies, and reporting."""
    
    def __init__(self):
        super().__init__()
        self.neural_core = NeuralCore()
    
    async def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if action == "analytics.anomaly":
            return await self.run_anomaly_detection(params)
        elif action == "analytics.cluster":
            return await self.run_clustering(params)
        elif action == "analytics.report":
            return await self.generate_report(params)
        elif action == "analytics.optimize":
            return await self.optimize_layout(params)
            
        return {"success": False, "error": f"Unknown analytics action: {action}"}
    
    async def run_anomaly_detection(self, params: Dict[str, Any]):
        # Call GNN (Neural Core) for real predictions
        # Fetch real nodes from the active context
        conn_id = self.neural_core.active_connection_id
        real_nodes = list(self.neural_core.gravity_stores.get(conn_id, {}).keys())
        
        # If no active context, fallback to empty or heuristic list
        if not real_nodes:
             sample_nodes = []
        else:
             # Take top 20 nodes to avoid timeout
             sample_nodes = real_nodes[:20]

        anomalies = []
        
        try:
           for node_id in sample_nodes:
               score = self.neural_core.predict_importance(node_id, "table")
               if score > 0.8: # Threshold
                   anomalies.append({"id": node_id, "score": score})
        except Exception as e:
            logger.warning(f"GNN Inference Failed: {e}")
            
        return {
            "success": True, 
            "action": "analytics.anomaly",
            "parameters": params,
            "result": {
                "action_type": "analytics",
                "instruction": "run_anomaly_detection",
                "count": len(anomalies),
                "anomalies": anomalies
            }
        }

    async def run_clustering(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "analytics.cluster",
            "parameters": params,
            "result": {
                "action_type": "analytics",
                "instruction": "apply_clustering"
            }
        }
        
    async def generate_report(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "analytics.report",
            "parameters": params,
            "result": {
                "action_type": "analytics",
                "instruction": "system_report"
            }
        }
        
    async def optimize_layout(self, params: Dict[str, Any]):
        return {
            "success": True, 
            "action": "analytics.optimize",
            "parameters": params,
            "result": {
                "action_type": "analytics",
                "instruction": "apply_clustering" # Mapped to same optimization toggle
            }
        }
