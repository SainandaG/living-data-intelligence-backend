
import pytest
from unittest.mock import MagicMock, patch
from backend.visualization.glow_calculator import GlowCalculator
from backend.app.config import feature_flags

def test_glow_fallback_safety_when_enabled(monkeypatch):
    """
    CRITICAL TEST: Verify that if we ENABLE the feature, but it CRASHES,
    we still get the original heuristic results.
    This ensures 'nothing is lost'.
    """
    # 1. Force Enable the feature
    monkeypatch.setattr(feature_flags, "USE_NETWORKX_GLOW", True)
    
    # 2. Simulate a crash in NetworkX (e.g., ImportError or runtime error)
    # We patch 'networkx.Graph' to raise an exception when accessed
    with patch.dict('sys.modules', {'networkx': None}):
        calc = GlowCalculator()
        nodes = [{'id': 'SafeNode', 'record_count': 50}]
        edges = []
        
        # 3. Run Calculation
        result = calc.batch_calculate(nodes, edges)
        
        # 4. Assertions
        # It should NOT be empty
        assert 'SafeNode' in result['node_glows']
        # It should have a value (heuristic)
        # 0.5 * log(51) ≈ 1.96
        assert result['node_glows']['SafeNode'] > 0
        print(f"Fallback SUCCESS: Got value {result['node_glows']['SafeNode']} despite missing NetworkX")

def test_gnn_fallback_safety(monkeypatch):
    """
    Verify GNN falls back to heuristic if PyTorch fails or model is missing.
    """
    monkeypatch.setattr(feature_flags, "USE_GNN_INFERENCE", True)
    
    # Simulate Torch missing
    with patch.dict('sys.modules', {'torch': None}):
        from backend.ml.graph_neural_core import GraphNeuralCore
        gnn = GraphNeuralCore()
        
        node = {'id': 'A', 'edges': ['B', 'C', 'D']} # 3 connections
        
        # Should return heuristic score (log(4)*0.5 ≈ 0.69)
        score = gnn.calculate_importance(node)
        
        assert score > 0
        assert score < 1.0
        print(f"Fallback SUCCESS: Got score {score} despite missing Torch")
