
import sys
import os

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))

# Mocking graph_neural_core before importing latent_manager
# We need to make sure graph_neural_core is importable or mocked
from backend.app.services.latent_manager import latent_manager

def test_latent_manager_update():
    """
    Test the full update loop: Embeddings -> dimensionality reduction -> projection
    """
    # 1. Create Dummy Data
    # 4 nodes to allow PCA(n_components=3) to work comfortably
    nodes = [
        {"id": "user", "metadata": {"row_count": 1000}},
        {"id": "orders", "metadata": {"row_count": 5000}},
        {"id": "products", "metadata": {"row_count": 500}},
        {"id": "logs", "metadata": {"row_count": 10000}}
    ]
    edges = [
        {"source": "user", "target": "orders"},
        {"source": "orders", "target": "products"}
    ]
    
    # 2. Run Update
    success = latent_manager.update_latent_space(nodes, edges)
    
    # 3. Assertions
    assert success is True
    assert latent_manager.is_ready is True
    
    # Check Projections
    projections = latent_manager.get_projection()
    assert len(projections) == 4
    for nid in ["user", "orders", "products"]:
        assert nid in projections
        p = projections[nid]
        assert "x" in p and "y" in p and "z" in p
        # Check values are floats
        assert isinstance(p["x"], float)

def test_semantic_similarity():
    """
    Test finding similar nodes.
    """
    # Setup some manual high dim embeddings to control the test
    # A and B are close. C is opposite.
    latent_manager.high_dim_embeddings = {
        "A": [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "B": [0.9, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "C": [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    }
    latent_manager.is_ready = True
    
    # Search for A
    sims = latent_manager.find_similar_nodes("A", top_k=2)
    
    print(sims)
    
    # Expect B to be top match
    assert len(sims) >= 2
    assert sims[0]["node_id"] == "B"
    assert sims[0]["similarity"] > 0.8
    
    # C should be lower
    # Cosine sim of [1,0] and [0,1] is 0
    c_match = next((s for s in sims if s["node_id"] == "C"), None)
    if c_match:
        assert c_match["similarity"] < 0.2
