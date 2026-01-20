import math

def sigmoid(x):
    return 1 / (1 + math.exp(-x))

def calculate_neural_metrics(table, in_degree, out_degree):
    # 1. Structural Score (Centrality)
    # Hubs (high in-degree) are more important than spokes
    struct_score = (in_degree * 1.5) + (out_degree * 0.5)
    normalized_struct = min(1.0, struct_score / 10.0) # Normalize cap at 10 connections
    
    # 2. Static Complexity
    row_weight = math.log10(max(1, table.get('row_count', 0) or 1)) * 0.3
    col_weight = len(table.get('columns', [])) * 0.05
    
    # 3. Neural Importance (Weighted Sigmoid)
    # Input range roughly 0 to 10, mapped to 0.0-1.0
    raw_importance = row_weight + (normalized_struct * 5.0) + col_weight
    neural_importance = sigmoid(raw_importance - 3) # Shift sigmoid center
    
    return {
        "structural": round(normalized_struct, 2),
        "neural": round(neural_importance, 2)
    }

# Test
if __name__ == "__main__":
    mock_table = {"row_count": 1000, "columns": [{}, {}, {}]}
    print(calculate_neural_metrics(mock_table, 5, 2))
