import math
from typing import Dict, List, Any

class GlowCalculator:
    """
    calculates mathematical glow values for graph nodes and edges.
    Server-side implementation of the frontend shader logic.
    """
    
    def __init__(self):
        # Tuning constants matching frontend
        self.alpha = 0.5  # Log count weight
        self.beta = 0.8   # Centrality weight
        self.gamma = 0.3  # Edge weight
        self.delta = 0.6  # Semantic similarity weight

    def batch_calculate(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate glow properties for a batch of graph elements.
        """
        try:
            from backend.app.config.feature_flags import USE_NETWORKX_GLOW
        except ImportError:
            # Fallback for when running in different context or if path isn't set up
            try:
                from app.config.feature_flags import USE_NETWORKX_GLOW
            except ImportError:
                USE_NETWORKX_GLOW = False
        
        node_glows = {}
        edge_glows = {}
        
        # Advanced NetworkX Calculation (Gated)
        if USE_NETWORKX_GLOW:
            try:
                import networkx as nx
                G = nx.Graph()
                
                # Build graph
                for n in nodes:
                    G.add_node(n.get('id'))
                for e in edges:
                    G.add_edge(e.get('source'), e.get('target'), weight=e.get('weight', 1))
                
                # Calculate rigorous metrics
                degree_cent = nx.degree_centrality(G)
                between_cent = nx.betweenness_centrality(G, weight='weight', k=min(100, len(G))) # Approximation for speed
                edge_between = nx.edge_betweenness_centrality(G, weight='weight', k=min(100, len(G)))
                
                # Compute Glows
                for node_id in degree_cent:
                    n_v = 0 # Need record_count map if we want to combine
                    # Find original node for record count
                    orig_node = next((n for n in nodes if n.get('id') == node_id), {})
                    n_v = orig_node.get('record_count', 0)
                    
                    c_v = between_cent[node_id] + degree_cent[node_id]
                    glow = (self.alpha * math.log(n_v + 1)) + (self.beta * c_v * 5.0) # Boost centrality impact
                    node_glows[node_id] = min(max(glow, 0.1), 3.0)

                for u, v in edge_between:
                    glow = (self.gamma * 1.0) + (self.delta * edge_between[(u, v)] * 10.0)
                    # Find edge ID... complex map required, fallback for now:
                    # In real impl, we'd map (u,v) back to edge ID
                    pass

            except ImportError:
                print("NetworkX not available, falling back to heuristic")
            except Exception as e:
                print(f"Graph calculation failed: {e}, falling back")

        # Fallback / Default Heuristic
        if not node_glows:
            for node in nodes:
                # NodeGlow(v) = α·log(N_v + 1) + β·C_v
                n_v = node.get('record_count', 0)
                c_v = node.get('centrality', 0.0)
                
                glow = (self.alpha * math.log(n_v + 1)) + (self.beta * c_v)
                glow = min(max(glow, 0.1), 3.0) 
                node_glows[node.get('id')] = glow
            
        if not edge_glows:
            for edge in edges:
                # EdgeGlow(u,v) = γ·log(R_uv + 1) + δ·cos(θ_uv)
                r_uv = edge.get('weight', 1)
                sim = edge.get('similarity', 0.5)
                
                glow = (self.gamma * math.log(r_uv + 1)) + (self.delta * sim)
                edge_glows[edge.get('id')] = glow
            
        return {
            "node_glows": node_glows,
            "edge_glows": edge_glows
        }
