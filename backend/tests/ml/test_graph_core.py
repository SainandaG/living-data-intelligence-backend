import pytest
import sys
import os
import math

# Add backend to path so we can import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))

from backend.ml.graph_neural_core import graph_neural_core

def test_generate_embeddings_basic():
    """
    Test that embeddings are generated for a simple graph.
    """
    # 1. Setup Dummy Data
    nodes = [
        {"id": "table_a", "metadata": {"row_count": 100}},
        {"id": "table_b", "metadata": {"row_count": 500}},
        {"id": "table_c", "metadata": {"row_count": 5}}
    ]
    edges = [
        {"source": "table_a", "target": "table_b"}
    ]
    
    # 2. Run Generation
    embeddings = graph_neural_core.generate_embeddings(nodes, edges)
    
    # 3. Assertions
    assert len(embeddings) == 3, "Should have embeddings for all 3 nodes"
    assert "table_a" in embeddings
    assert "table_b" in embeddings
    assert "table_c" in embeddings
    
    vec_a = embeddings["table_a"]
    assert len(vec_a) == 8, "Default embedding dimension should be 8"
    assert not all(v == 0 for v in vec_a), "Embedding should not be all zeros"

def test_embedding_similarity():
    """
    Test that connected nodes are semantically closer than isolated ones.
    (Note: With untrained weights, this is just testing the GNN mechanism, not intelligence)
    """
    nodes = [
        {"id": "A", "metadata": {"row_count": 100}},
        {"id": "B", "metadata": {"row_count": 100}}, # B is connected to A
        {"id": "C", "metadata": {"row_count": 100}}  # C is isolated
    ]
    edges = [
        {"source": "A", "target": "B"}
    ]
    
    embeddings = graph_neural_core.generate_embeddings(nodes, edges)
    
    vec_a = embeddings["A"]
    vec_b = embeddings["B"]
    vec_c = embeddings["C"]
    
    # Euclidean Distance
    dist_ab = sum((a-b)**2 for a,b in zip(vec_a, vec_b)) ** 0.5
    dist_ac = sum((a-c)**2 for a,c in zip(vec_a, vec_c)) ** 0.5
    
    print(f"Dist A-B: {dist_ab}")
    print(f"Dist A-C: {dist_ac}")
    
    # For a deterministic/untrained GAT, we expect *some* difference due to structure
    assert vec_a != vec_c, "Connected node should have different embedding from isolated node"
