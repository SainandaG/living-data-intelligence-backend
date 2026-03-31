import sys
import os
import torch

# Add backend directory to sys.path for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ml.gnn_model import GATLayer, GNNModel

def test_gat_layer_dimensions():
    """Verify that GATLayer returns the expected output shape"""
    in_features = 16
    out_features = 8
    num_nodes = 10
    
    layer = GATLayer(in_features, out_features)
    h = torch.randn(num_nodes, in_features)
    adj = torch.ones(num_nodes, num_nodes)
    
    output = layer(h, adj)
    assert output.shape == (num_nodes, out_features)

def test_gat_layer_attention():
    """Verify attention mechanism logic (softmax over neighbors)"""
    in_features = 16
    out_features = 8
    num_nodes = 3
    
    layer = GATLayer(in_features, out_features)
    h = torch.randn(num_nodes, in_features)
    # Adjacency matrix: Node 0 connected to 1 and 2, but 1 and 2 not connected to each other
    adj = torch.tensor([
        [1, 1, 1],
        [1, 1, 0],
        [1, 0, 1]
    ], dtype=torch.float32)
    
    # We can't easily check internal attention without modifying the layer
    # but we can verify the forward pass doesn't crash and returns finite values
    output = layer(h, adj)
    assert torch.isfinite(output).all()

def test_gnn_model_full_pass():
    """Verify the full GNNModel forward pass"""
    in_features = 16
    hidden_features = 8
    out_features = 4
    num_nodes = 5
    
    model = GNNModel(in_features, hidden_features, out_features)
    x = torch.randn(num_nodes, in_features)
    adj = torch.eye(num_nodes)
    
    output = model(x, adj)
    assert output.shape == (num_nodes, out_features)
    # GNNModel uses log_softmax, so values should be <= 0
    assert (output <= 0).all()

def test_gnn_gradient_flow():
    """Verify that gradients can flow through the model for training"""
    in_features = 16
    hidden_features = 8
    out_features = 4
    num_nodes = 5
    
    model = GNNModel(in_features, hidden_features, out_features)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    
    x = torch.randn(num_nodes, in_features)
    adj = torch.eye(num_nodes)
    target = torch.randint(0, out_features, (num_nodes,))
    
    # Forward pass
    output = model(x, adj)
    loss = torch.nn.functional.nll_loss(output, target)
    
    # Backward pass
    optimizer.zero_grad()
    loss.backward()
    
    # Check if weights have gradients
    assert model.layer1.W.grad is not None
    assert model.layer2.a.grad is not None
    
    # Optimizer step
    optimizer.step()
    assert True # If it reaches here without error, it works
