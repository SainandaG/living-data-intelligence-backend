import torch
import numpy as np
import json
import os
from typing import List, Dict, Any

# Mock data for initial implementation if DB is unavailable
MOCK_NODES = [
    {"id": "0", "type": "table", "record_count": 1000, "centrality": 0.8, "target": 1.0},
    {"id": "1", "type": "table", "record_count": 500, "centrality": 0.3, "target": 0.2},
    {"id": "2", "type": "table", "record_count": 5000, "centrality": 0.9, "target": 0.9},
    {"id": "3", "type": "table", "record_count": 100, "centrality": 0.1, "target": 0.0},
    {"id": "4", "type": "table", "record_count": 1200, "centrality": 0.5, "target": 0.5},
]

MOCK_EDGES = [
    (0, 1), (0, 2), (2, 3), (1, 4), (0, 4)
]

def collect_training_data():
    """
    Collects graph data and saves it as a PyTorch Geometric compatible format.
    In a real scenario, this would query the DatabaseConnector and GraphEngine.
    """
    print("🧹 Collecting training data...")
    
    # 1. Node Features [record_count, centrality, degree]
    node_features = []
    node_labels = []
    
    # Mocking degree calculation
    degrees = {str(i): 0 for i in range(5)}
    for u, v in MOCK_EDGES:
        degrees[str(u)] += 1
        degrees[str(v)] += 1

    for node in MOCK_NODES:
        feat = [
            float(node['record_count']) / 5000.0, # Normalized
            float(node['centrality']),
            float(degrees[node['id']]) / 5.0 # Normalized
        ]
        node_features.append(feat)
        node_labels.append([node['target']])

    x = torch.tensor(node_features, dtype=torch.float)
    y = torch.tensor(node_labels, dtype=torch.float)
    
    # 2. Edge Index
    edge_index = torch.tensor(MOCK_EDGES, dtype=torch.long).t().contiguous()
    
    # 3. Save
    data_dir = "backend/ml/models"
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        
    torch.save({
        'x': x,
        'y': y,
        'edge_index': edge_index
    }, os.path.join(data_dir, "training_data.pt"))
    
    print(f"✅ Data saved to {os.path.join(data_dir, 'training_data.pt')}")

if __name__ == "__main__":
    collect_training_data()
