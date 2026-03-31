import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class InfluenceCalculator:
    """
    Calculates the influence of nodes in the graph to determine
    importance and propagation power.
    """
    
    def __init__(self):
        self.use_networkx = False
        try:
            from backend.app.config.feature_flags import USE_NETWORKX_GLOW
            self.use_networkx = USE_NETWORKX_GLOW
        except ImportError:
            try:
                from app.config.feature_flags import USE_NETWORKX_GLOW
                self.use_networkx = USE_NETWORKX_GLOW
            except ImportError:
                pass

    def calculate(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Calculate influence scores for all nodes.
        Returns map of node_id -> influence_score (0.0 - 1.0)
        """
        if self.use_networkx:
            try:
                import networkx as nx
                G = nx.DiGraph()
                for n in nodes:
                    G.add_node(n['id'])
                for e in edges:
                    G.add_edge(e['source'], e['target'], weight=e.get('weight', 1.0))
                
                # PageRank as a proxy for influence
                pagerank = nx.pagerank(G, weight='weight')
                return pagerank
            except Exception as e:
                logger.error(f"NetworkX influence calc failed: {e}")
                
        # Default Heuristic
        influence = {}
        for node in nodes:
            # Simple degree-based heuristic
            degree = sum(1 for e in edges if e['source'] == node['id'] or e['target'] == node['id'])
            influence[node['id']] = min(degree / 10.0, 1.0) # Cap at 10 connections
            
        return influence

    def calculate_pairwise(self, u: str, v: str, graph_data: Dict[str, Any]) -> float:
        """
        Calculate semantic influence/similarity between two specific nodes.
        Influence(u→v) = cos(θ_uv)
        """
        # Placeholder for vector similarity logic
        # In real impl, checking if edge exists gives 1.0, else 0.0
        edges = graph_data.get('edges', [])
        for e in edges:
            if (e['source'] == u and e['target'] == v) or (e['source'] == v and e['target'] == u):
                return e.get('similarity', 0.8)
                
        return 0.0
