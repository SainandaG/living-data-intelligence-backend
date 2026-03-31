"""
glow_calculator.py
Computes visual intensity scores for graph nodes and edges.

DATA PROVENANCE:
  All glow/vitality scores are CALCULATED values derived from graph structure:
    NodeGlow(v) = α·log(row_count + 1) + β·centrality
    EdgeGlow(u,v) = γ·log(relationship_count + 1) + δ·semantic_similarity

  These are mathematical proxies for "visual importance" in the 3D graph.
  They do NOT measure actual database query performance, latency, or real-time load.
  Row counts come from schema metadata (real); centrality is computed from graph topology.
"""
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
        Formula: NodeGlow(v) = α·log(N_v + 1) + β·C_v
        Source:
          - N_v (row_count): real schema metadata count
          - C_v (centrality): computed from graph in/out-degree topology
          - Result: visual intensity proxy, not a performance measurement
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
        Formula: EdgeGlow(u,v) = γ·log(R_uv + 1) + δ·cos(θ_uv)
        Source:
          - R_uv (relationship_count): FK/join count from schema analysis
          - θ_uv (semantic_similarity): cosine similarity of feature vectors
          - Result: visual intensity proxy, not a query frequency measurement
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
            node.get('id', node.get('name', 'node_' + str(i))): self.calculate_node_glow(
                node.get('record_count', 0),
                node.get('centrality', 0.0)
            )
            for i, node in enumerate(nodes)
        }
        
        edge_glows = {
            edge.get('id', f"edge_{i}"): self.calculate_edge_glow(
                edge.get('relationship_count', 0),
                edge.get('semantic_similarity', 0.0)
            )
            for i, edge in enumerate(edges)
        }
        
        return {
            'node_glows': node_glows,
            'edge_glows': edge_glows,
            '_meta': {
                'source': 'formula_derived',
                'description': (
                    'Glow scores are computed values: α·log(row_count+1) + β·centrality. '
                    'They represent visual structural importance, not runtime performance metrics.'
                ),
                'inputs': {
                    'row_count': 'real schema metadata',
                    'centrality': 'computed from graph topology',
                    'relationship_count': 'FK count from schema analysis',
                    'semantic_similarity': 'cosine similarity of feature vectors',
                },
                'real_performance_data': False,
            },
        }
