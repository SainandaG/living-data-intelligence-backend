"""
Demo Data Generator - Creates sample banking data for visualization
Run this to see the platform in action without a real database
"""
import json
from datetime import datetime

def generate_demo_graph():
    """Generate a demo graph structure"""
    
    # Demo nodes (tables)
    nodes = [
        {
            "id": "accounts",
            "name": "accounts",
            "type": "dimension",
            "entity": "account",
            "size": 45,
            "color": "#00d4ff",
            "row_count": 5000000,
            "metrics": ["balance", "credit_limit"],
            "x": 150,
            "y": 0,
            "z": 0
        },
        {
            "id": "transactions",
            "name": "transactions",
            "type": "fact",
            "entity": "transaction",
            "size": 60,
            "color": "#00ff88",
            "row_count": 50000000,
            "metrics": ["amount", "fee"],
            "x": -150,
            "y": 100,
            "z": 50
        },
        {
            "id": "customers",
            "name": "customers",
            "type": "dimension",
            "entity": "customer",
            "size": 40,
            "color": "#00ff88",
            "row_count": 3000000,
            "metrics": ["age", "credit_score"],
            "x": 0,
            "y": -150,
            "z": -50
        },
        {
            "id": "branches",
            "name": "branches",
            "type": "dimension",
            "entity": "branch",
            "size": 25,
            "color": "#ffd60a",
            "row_count": 450,
            "metrics": ["employee_count"],
            "x": 100,
            "y": 150,
            "z": 100
        },
        {
            "id": "fraud_alerts",
            "name": "fraud_alerts",
            "type": "fact",
            "entity": "fraud",
            "size": 35,
            "color": "#ff4757",
            "row_count": 25000,
            "metrics": ["risk_score", "amount_involved"],
            "x": -100,
            "y": -100,
            "z": 150
        },
        {
            "id": "loans",
            "name": "loans",
            "type": "dimension",
            "entity": "loan",
            "size": 38,
            "color": "#9d4edd",
            "row_count": 800000,
            "metrics": ["principal", "interest_rate"],
            "x": -150,
            "y": 0,
            "z": -100
        },
        {
            "id": "cards",
            "name": "cards",
            "type": "dimension",
            "entity": "card",
            "size": 42,
            "color": "#ff6b9d",
            "row_count": 4000000,
            "metrics": ["credit_limit", "balance"],
            "x": 150,
            "y": -50,
            "z": 100
        }
    ]
    
    # Demo edges (relationships)
    edges = [
        {"source": "transactions", "target": "accounts", "type": "foreign_key"},
        {"source": "transactions", "target": "customers", "type": "foreign_key"},
        {"source": "transactions", "target": "branches", "type": "foreign_key"},
        {"source": "accounts", "target": "customers", "type": "foreign_key"},
        {"source": "fraud_alerts", "target": "transactions", "type": "foreign_key"},
        {"source": "loans", "target": "customers", "type": "foreign_key"},
        {"source": "cards", "target": "accounts", "type": "foreign_key"}
    ]
    
    return {"nodes": nodes, "edges": edges}

if __name__ == "__main__":
    graph = generate_demo_graph()
    print(json.dumps(graph, indent=2))
    
    # Save to file
    with open('demo_graph.json', 'w') as f:
        json.dump(graph, f, indent=2)
    
    print("\n✅ Demo graph saved to demo_graph.json")
    print("📊 Contains 7 tables and 7 relationships")
    print("🎨 Ready for visualization!")
