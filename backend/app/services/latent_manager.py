"""
Latent Manager

Coordinates latent space embeddings across connections for the Galaxy visualization.
"""

import logging
import numpy as np
from typing import Dict, List, Any
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import cosine_similarity
import threading

# Import the ML core
try:
    # Try absolute path from workspace root first
    from backend.ml.graph_neural_core import graph_neural_core
except ImportError:
    try:
        # Fallback for when backend directory is the root
        from ml.graph_neural_core import graph_neural_core # type: ignore
    except ImportError:
        try:
            # Fallback for relative import
            from ...ml.graph_neural_core import graph_neural_core # type: ignore
        except ImportError:
            logger.error(" Could not import graph_neural_core from any known path")
            graph_neural_core = None # type: ignore

logger = logging.getLogger(__name__)

class LatentSpaceManager:
    """
    Manages the "Latent Space" of the Living Graph.
    - Generates embeddings via GraphNeuralCore.
    - Projects high-dim vectors to 3D (x,y,z) for visualization.
    - Performs semantic search.
    """
    def __init__(self):
        self.high_dim_embeddings: Dict[str, List[float]] = {}
        self.projected_embeddings: Dict[str, Dict[str, float]] = {}
        self.pca_model = PCA(n_components=3)
        self.is_ready = False
        self._lock = threading.Lock()

    def update_latent_space(self, nodes: List[Dict], edges: List[Dict]) -> bool:
        """
        Refresh the entire latent space based on new graph topology.
        This should be called when schema/graph structure changes significantly.
        """
        logger.info(f" Recalculating Latent Space for {len(nodes)} nodes...")
        
        try:
            # 1. Generate High-Dim Embeddings (Dim=8)
            embeddings = graph_neural_core.generate_embeddings(nodes, edges)
            
            if not embeddings:
                logger.warning("No embeddings generated.")
                return False

            with self._lock:
                self.high_dim_embeddings = embeddings
                
                # 2. Dimensionality Reduction (8 -> 3)
                node_ids = list(embeddings.keys())
                matrix = np.array([embeddings[nid] for nid in node_ids])
                
                # PCA requires samples >= n_components
                if len(node_ids) >= 3:
                    projected_matrix = self.pca_model.fit_transform(matrix)
                else:
                    # Fallback for tiny graphs: just slice dimensions or use random
                    logger.info("Graph too small for PCA, using slice/random.")
                    projected_matrix = matrix[:, :3] 
                    # If still < 3 dims (unlikely with dim=8), pad
                    if projected_matrix.shape[1] < 3:
                        pad = np.zeros((len(node_ids), 3 - projected_matrix.shape[1]))
                        projected_matrix = np.hstack([projected_matrix, pad])

                # 3. specific node data
                self.projected_embeddings = {}
                for i, nid in enumerate(node_ids):
                    vec = projected_matrix[i]
                    # Normalize to fit roughly in a -100 to +100 world coordinate system for Three.js
                    # PCA is usually centered around 0. Let's scale it up.
                    x, y, z = vec[0] * 50, vec[1] * 50, vec[2] * 50
                    
                    self.projected_embeddings[nid] = {
                        "x": float(x),
                        "y": float(y),
                        "z": float(z),
                        # Simple clustering: sign of principal components
                        "cluster": int(np.sign(vec[0]) + np.sign(vec[1])*2) 
                    }
                
                self.is_ready = True
                logger.info(" Latent Space Updated.")
                return True
                
        except Exception as e:
            logger.error(f"Failed to update latent space: {e}")
            import traceback
            traceback.print_exc()
            return False

    def get_projection(self) -> Dict[str, Dict[str, float]]:
        """Return the current 3D projection for visualization."""
        with self._lock:
            return self.projected_embeddings.copy()

    def find_similar_nodes(self, node_id: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Semantic Search: Find nodes with similar embeddings.
        """
        if not self.is_ready or node_id not in self.high_dim_embeddings:
            return []

        target_vec = np.array(self.high_dim_embeddings[node_id]).reshape(1, -1)
        
        candidates = []
        candidate_ids = []
        
        with self._lock:
            for nid, vec in self.high_dim_embeddings.items():
                if nid == node_id: continue
                candidates.append(vec)
                candidate_ids.append(nid)
        
        if not candidates:
            return []
            
        candidate_matrix = np.array(candidates)
        
        # Cosine Similarity: returns [[score1, score2, ...]]
        similarities = cosine_similarity(target_vec, candidate_matrix)[0]
        
        # Top K
        # unsorted indexes of top K
        if len(similarities) < top_k:
            top_k = len(similarities)
            
        # Get indices of top k elements
        top_indices = np.argpartition(similarities, -top_k)[-top_k:]
        # Sort them by score descending
        top_indices = top_indices[np.argsort(similarities[top_indices])][::-1]
        
        results = []
        for idx in top_indices:
            results.append({
                "node_id": candidate_ids[idx],
                "similarity": float(similarities[idx]),
                "reason": "Latent vector alignment"
            })
            
        return results

    def search_nodes(self, query: str, connection_id: str, top_k: int = 10, filters: Dict = None) -> List[Dict]:
        """
        Broad semantic search combining name/metadata similarity 
        with specific category/priority filters.
        """
        if not self.is_ready:
            return []

        query = query.lower()
        results = []
        
        with self._lock:
            for nid, vec in self.high_dim_embeddings.items():
                # 1. Text match heuristic
                score = 0.0
                if query in nid.lower():
                    score += 0.5
                
                # 2. Add structural similarity if we had a reference node, 
                # but for global search we mostly rely on name + types for now.
                
                # 3. Apply Filters (Categories/Priority)
                # These filters are usually pre-passed from NeuralCore's knowledge
                if filters:
                    _cat_match = True
                    if filters.get('categories'):
                        # This would be checked against a lookup we pass in
                        pass
                
                if score > 0 or not query:
                    results.append({
                        "node_id": nid,
                        "score": score,
                        "projection": self.projected_embeddings.get(nid)
                    })
        
        # Sort and return
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

# Global Instance
latent_manager = LatentSpaceManager()

