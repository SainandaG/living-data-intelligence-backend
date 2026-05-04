"""
Intelligence Engine: The Projection Layer
Projects the immutable state chain into human-readable insights and narratives.
"""
from typing import Dict, List, Any
from datetime import datetime
from app.services.neural_core import neural_core
from app.services.latent_space_service import latent_space_service

class IntelligenceEngine:
    """A pure projection function of the system's evolving state."""
    
    async def project_current_state(self, connection_id: str, enriched_nodes: List[Dict]) -> Dict[str, Any]:
        """
        Project the current neural/latent state into a unified intelligence payload.
        Ensures no component maintains an independent version of truth.
        """
        # 1. Capture snapshots from reality sources
        core_metrics = await neural_core.get_core_metrics()
        
        # 2. Derive Global Narratives from Motion
        avg_v = sum(n.get('velocity_magnitude', 0) for n in enriched_nodes) / max(len(enriched_nodes), 1)
        narrative = self._project_narrative(core_metrics, avg_v, enriched_nodes)
        
        # 3. Assemble Unified Projection
        return {
            "connection_id": connection_id,
            "timestamp": datetime.now().isoformat(),
            "core_intelligence": core_metrics,
            "latent_summary": {
                "avg_velocity": round(avg_v, 2),
                "active_signals": core_metrics.get('signal_load', 0),
                "evolution_growth": core_metrics.get('growth', 1.0)
            },
            "narrative": narrative,
            "manifold_parameters": latent_space_service.generate_manifold_data(enriched_nodes)
        }

    def _project_narrative(self, metrics: Dict, avg_v: float, nodes: List[Dict]) -> str:
        """Translate state motion into explainable intelligence."""
        status = metrics.get('status', 'IDLE')
        growth = metrics.get('growth', 1.0)
        
        # Motion-Based Reasoning
        if avg_v > 50.0:
            motion_desc = "The system is exhibiting high volatility and rapid state transitions."
        elif avg_v > 10.0:
            motion_desc = "System state is evolving steadily toward new equilibrium."
        else:
            motion_desc = "System topology is currently in a stable, state-locked configuration."

        # Peak Identification
        high_risk_nodes = [n['name'] for n in nodes if n.get('latent_y', 0) > 400]
        peak_desc = ""
        if high_risk_nodes:
            peak_desc = f" Critical risk peaks detected on: {', '.join(high_risk_nodes[:2])}."

        return f"Intelligence Mode: {status}. {motion_desc} {peak_desc} Evolutionary Growth: {growth:.2f}."

# Global Instance
intelligence_engine = IntelligenceEngine()
