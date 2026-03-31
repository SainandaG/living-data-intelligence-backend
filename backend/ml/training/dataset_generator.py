import torch
import numpy as np
import random
from typing import Tuple, Dict, Any

class DatasetGenerator:
    """
    Generates dataset for Graph Neural Network training.
    Supports synthetic data generation for initialization.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        
    def generate_synthetic_data(self) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Generate synthetic graph data.
        Returns:
            features: Node feature matrix (N x F)
            adj: Adjacency matrix (N x N)
            labels: Node labels/importance scores (N x 1)
        """
        num_nodes = self.config['data'].get('synthetic_nodes', 100)
        in_features = self.config['model'].get('in_features', 16)
        
        # 1. Generate random node features
        features = torch.randn(num_nodes, in_features)
        
        # 2. Generate random adjacency matrix (sparse)
        # Create random edges
        num_edges = self.config['data'].get('synthetic_edges', 300)
        adj = torch.eye(num_nodes) # Self loops
        
        for _ in range(num_edges):
            src = random.randint(0, num_nodes - 1)
            dst = random.randint(0, num_nodes - 1)
            adj[src, dst] = 1.0
            adj[dst, src] = 1.0 # Undirected
            
        # 3. Generate synthetic labels (Importance score based on degree)
        degrees = torch.sum(adj, dim=1).unsqueeze(1)
        # Add some noise
        noise = torch.randn(num_nodes, 1) * 0.1
        labels = (degrees / degrees.max()) + noise
        
        return features, adj, labels

    def save_dataset(self, path: str):
        """Save generated dataset to disk"""
        features, adj, labels = self.generate_synthetic_data()
        torch.save({
            'features': features,
            'adj': adj,
            'labels': labels
        }, path)
        print(f"Dataset saved to {path}")
