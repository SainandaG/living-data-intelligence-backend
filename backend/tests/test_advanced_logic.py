
import pytest
from backend.visualization.glow_calculator import GlowCalculator
from backend.ml.influence_calculator import InfluenceCalculator
from backend.app.config import feature_flags
import math

def test_glow_calculator_default_behavior():
    """Test that it works with default flags (False)"""
    calc = GlowCalculator()
    nodes = [{'id': 'A', 'record_count': 100}, {'id': 'B', 'record_count': 10}]
    edges = [{'id': 'E1', 'source': 'A', 'target': 'B', 'weight': 5}]
    
    result = calc.batch_calculate(nodes, edges)
    
    # Check heuristic logic was used
    # A: 0.5 * log(101) ≈ 0.5 * 4.6 = 2.3
    # B: 0.5 * log(11) ≈ 0.5 * 2.4 = 1.2
    assert result['node_glows']['A'] > 2.0
    assert result['node_glows']['B'] < 1.5

def test_influence_calculator_heuristics():
    calc = InfluenceCalculator()
    nodes = [{'id': 'A'}, {'id': 'B'}]
    edges = [{'source': 'A', 'target': 'B'}]
    
    # Should use degree heuristic
    scores = calc.calculate(nodes, edges)
    assert scores['A'] > 0
    assert scores['B'] > 0

def test_glow_calculator_with_networkx_enabled(monkeypatch):
    """Test with feature flag enabled"""
    monkeypatch.setattr(feature_flags, "USE_NETWORKX_GLOW", True)
    
    # Re-import to trigger flag check if it was cached (or logic inside method handles it)
    calc = GlowCalculator()
    nodes = [{'id': 'A', 'record_count': 100}, {'id': 'B', 'record_count': 10}, {'id': 'C', 'record_count': 5}]
    edges = [
        {'id': 'E1', 'source': 'A', 'target': 'B', 'weight': 1},
        {'id': 'E2', 'source': 'B', 'target': 'C', 'weight': 1}
    ]
    
    # B is central (between A and C)
    result = calc.batch_calculate(nodes, edges)
    
    # With NetworkX, B should get a centrality boost
    # If standard heuristic, A (high record count) would dominate completely
    # Just ensure it runs without crashing and produces numbers
    assert 'A' in result['node_glows']
    assert 'B' in result['node_glows']
