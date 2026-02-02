import math
from typing import Dict, List, Any

class GlowCalculator:
    """
    Server-side glow calculation for performance optimization.
    Calculates visual intensity properties for nodes and edges.
    """
    
    def calculate_node_glow(self, record_count: int, centrality: float,
                           alpha: float = 0.3, beta: float = 0.5) -> float:
        """
        NodeGlow(v) = α·log(N_v + 1) + β·C_v
        Returns a value typically between 0.0 and 2.0.
        """
        # Logarithmic scaling for usually large record counts
        record_component = alpha * math.log(record_count + 1)
        centrality_component = beta * centrality
        
        # Cap at max intensity
        return min(2.0, record_component + centrality_component)
    
    def calculate_edge_glow(self, relationship_count: int,
                           semantic_similarity: float,
                           gamma: float = 0.2, delta: float = 0.5) -> float:
        """
        EdgeGlow(u,v) = γ·log(R_uv + 1) + δ·cos(θ_uv)
        Returns a value typically between 0.0 and 1.0.
        """
        relationship_component = gamma * math.log(relationship_count + 1)
        similarity_component = delta * semantic_similarity
        
        return min(1.0, relationship_component + similarity_component)
    
    def batch_calculate(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
        """
        Batch calculation for large graphs to offload from frontend.
        """
        node_glows = {
            node['id']: self.calculate_node_glow(
                node.get('record_count', 0),
                node.get('centrality', 0.0)
            )
            for node in nodes
        }
        
        edge_glows = {
            edge['id']: self.calculate_edge_glow(
                edge.get('relationship_count', 0),
                edge.get('semantic_similarity', 0.0)
            )
            for edge in edges
        }
        
        return {'nodes': node_glows, 'edges': edge_glows}
