
import logging
import math
import networkx as nx
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class GraphNeuralCore:
    """
    Real-time Graph Topology Engine (NetworkX Powered).
    Replaces "Black Box" GNN with transparent, mathematically proven graph algorithms.
    """
    def __init__(self):
        self.graph = nx.DiGraph()
        self.metrics_cache = {}
        self.last_topo_hash = ""

    @staticmethod
    def _row_count(n: Dict) -> int:
        """Extract row_count from a node dict, handling both flat and nested formats."""
        if 'row_count' in n:
            return int(n.get('row_count') or 0)
        return int((n.get('metadata') or {}).get('row_count') or 0)

    def _build_graph_if_needed(self, nodes: List[Dict], edges: List[Dict]):
        """
        Rebuilds the internal NetworkX graph only if topology changed.
        """
        # Hash includes node IDs and edge pairs so different graphs with the same
        # counts (e.g. two 3-node/1-edge graphs with different node names) always rebuild.
        node_ids = tuple(sorted(n['id'] for n in nodes))
        edge_pairs = tuple(sorted((e.get('source', ''), e.get('target', '')) for e in edges))
        current_hash = f"{node_ids}-{edge_pairs}"
        if current_hash == self.last_topo_hash:
            return

        self.graph.clear()

        # Add Nodes with weight
        for n in nodes:
            # Base weight = Log(Row Count) - larger tables have more "mass"
            rows = self._row_count(n)
            mass = math.log10(max(1, rows)) + 1.0
            self.graph.add_node(n['id'], mass=mass, type=n.get('table_type', 'dimension'))

        # Add Edges
        for e in edges:
            src, tgt = e.get('source'), e.get('target')
            if src and tgt:
                # FKs are strong (1.0), Soft links are weak (0.5)
                weight = 1.0 if e.get('type') == 'foreign_key' else 0.5
                self.graph.add_edge(src, tgt, weight=weight)
                
        self.last_topo_hash = current_hash
        self._recalculate_centrality()

    def _recalculate_centrality(self):
        """
        Compute 'Neural Gravity' using PageRank and Betweenness Centrality.
        """
        try:
            if self.graph.number_of_nodes() == 0:
                self.metrics_cache = {}
                return

            # 1. PageRank (Gravity) - How many important nodes point to me?
            # We use 'mass' (row count) as personalization vector if possible, 
            # otherwise standard PR.
            try:
                # Personalization based on table size (Mass)
                personalization = {n: d.get('mass', 1.0) for n, d in self.graph.nodes(data=True)}
                # Normalize personalization
                total_mass = sum(personalization.values())
                if total_mass > 0:
                    personalization = {k: v/total_mass for k, v in personalization.items()}
                
                pagerank = nx.pagerank(self.graph, alpha=0.85, weight='weight', personalization=personalization)
            except Exception:
                # Fallback to unweighted
                pagerank = nx.pagerank(self.graph, alpha=0.85)

            # 2. Degree Centrality (Connectivity)
            degree = nx.degree_centrality(self.graph)

            # 3. Store normalized results
            # Boost scores to 1-10 range for UI
            # Ensure no division by zero if max is 0 (e.g. no edges)
            max_pr = max(pagerank.values()) if pagerank else 0
            if max_pr == 0: max_pr = 1
            
            max_deg = max(degree.values()) if degree else 0
            if max_deg == 0: max_deg = 1

            for n in self.graph.nodes():
                pr_score = (pagerank.get(n, 0) / max_pr) * 10
                deg_score = (degree.get(n, 0) / max_deg) * 10
                
                # Combined Score: 70% Gravity (PR), 30% Connectivity (Degree)
                final_gravity = (pr_score * 0.7) + (deg_score * 0.3)
                
                self.metrics_cache[n] = {
                    'gravity': round(final_gravity, 2),
                    'pagerank': pr_score,
                    'degree': deg_score
                }
                
            logger.info(f"✅ Recalculated Graph Topology for {len(self.graph)} nodes.")
                
        except Exception as e:
            logger.error(f"Topology calculation failed: {e}")
            self.metrics_cache = {}

    def predict_importance(self, node_id: str, node_type: str = "table", node_data: Dict[str, Any] = None) -> float:
        """
        Return the calculated PageRank-based gravity.
        """
        # If we have a cached calculation, use it
        if node_id in self.metrics_cache:
            return self.metrics_cache[node_id]['gravity']
            
        # Fallback if graph hasn't been built yet (start-up)
        # Use simple degree count from node_data if available
        if node_data:
            edges = len(node_data.get('edges', []))
            return min(10.0, max(1.0, edges / 2.0))
            
        return 5.0 # Neutral default

    def calculate_importance(self, node: Dict[str, Any]) -> float:
        """Alias for backward compatibility with graph.py"""
        return self.predict_importance(node.get('id'), node.get('type', 'table'), node)

    def generate_embeddings(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, List[float]]:
        """
        Generate 8-dimensional Topological Embeddings.

        Dimensions:
          0 - gravity         (combined PageRank + degree score, 0–10)
          1 - pagerank        (normalised PageRank, 0–10)
          2 - degree          (normalised degree centrality, 0–10)
          3 - in_degree       (raw in-degree, normalised 0–10)
          4 - out_degree      (raw out-degree, normalised 0–10)
          5 - row_count_log   (log10 of row count)
          6 - clustering      (local clustering coefficient, 0–1)
          7 - closeness       (closeness centrality, 0–1)
        """
        self._build_graph_if_needed(nodes, edges)

        # Pre-compute per-node structural metrics
        undirected = self.graph.to_undirected()
        try:
            clustering = nx.clustering(undirected)
        except Exception:
            clustering = {n: 0.0 for n in self.graph.nodes()}
        try:
            closeness = nx.closeness_centrality(self.graph)
        except Exception:
            closeness = {n: 0.0 for n in self.graph.nodes()}

        max_in  = max((d for _, d in self.graph.in_degree()),  default=1) or 1
        max_out = max((d for _, d in self.graph.out_degree()), default=1) or 1

        embeddings = {}
        for n in nodes:
            nid = n['id']
            metrics = self.metrics_cache.get(nid, {'gravity': 1.0, 'pagerank': 0.0, 'degree': 0.0})

            row_log   = math.log10(max(1, self._row_count(n)))
            in_deg    = (self.graph.in_degree(nid)  if nid in self.graph else 0) / max_in  * 10
            out_deg   = (self.graph.out_degree(nid) if nid in self.graph else 0) / max_out * 10
            clust     = clustering.get(nid, 0.0)
            close     = closeness.get(nid, 0.0)

            vector = [
                metrics['gravity'],    # 0 – combined importance
                metrics['pagerank'],   # 1 – PageRank score
                metrics['degree'],     # 2 – degree centrality
                round(in_deg, 4),      # 3 – in-degree
                round(out_deg, 4),     # 4 – out-degree
                round(row_log, 4),     # 5 – size (log scale)
                round(clust, 4),       # 6 – clustering
                round(close, 4),       # 7 – closeness
            ]
            embeddings[nid] = vector

        return embeddings

    def predict_links(self, node_id: str, graph_context: Dict[str, Any]) -> List[Dict]:
        """
        Suggest links using Adamic-Adar Index (Friends of Friends).
        """
        if node_id not in self.graph: 
            return []
            
        # Convert directed to undirected for community link prediction
        undirected = self.graph.to_undirected()
        
        suggestions = []
        try:
            # Predict links to nodes 2 hops away
            preds = nx.adamic_adar_index(undirected, [(node_id, n) for n in self.graph.nodes() if n != node_id and not self.graph.has_edge(node_id, n)])
            
            for u, v, p in preds:
                if p > 0.5: # Threshold
                    suggestions.append({
                        'target_id': v,
                        'confidence': min(0.9, p / 5.0), # Normalize
                        'reasoning': 'Shared Connections (Adamic-Adar)'
                    })
        except Exception:
            pass
            
        return sorted(suggestions, key=lambda x: x['confidence'], reverse=True)[:3]

# Global Instance
graph_neural_core = GraphNeuralCore()
