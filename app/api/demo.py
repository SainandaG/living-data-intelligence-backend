from fastapi import APIRouter
from app.models.schemas import Graph, GraphNode, GraphEdge

router = APIRouter()

@router.get("/demo/graph")
async def get_demo_graph():
    """Get demo graph for testing without database connection"""
    
    # Demo nodes
    nodes = [
        GraphNode(
            id="accounts",
            name="accounts",
            type="dimension",
            entity="account",
            size=45,
            color="#00d4ff",
            row_count=5000000,
            metrics=["balance", "credit_limit"],
            x=150, y=0, z=0
        ),
        GraphNode(
            id="transactions",
            name="transactions",
            type="fact",
            entity="transaction",
            size=60,
            color="#00ff88",
            row_count=50000000,
            metrics=["amount", "fee"],
            x=-150, y=100, z=50
        ),
        GraphNode(
            id="customers",
            name="customers",
            type="dimension",
            entity="customer",
            size=40,
            color="#00ff88",
            row_count=3000000,
            metrics=["age", "credit_score"],
            x=0, y=-150, z=-50
        ),
        GraphNode(
            id="branches",
            name="branches",
            type="dimension",
            entity="branch",
            size=25,
            color="#ffd60a",
            row_count=450,
            metrics=["employee_count"],
            x=100, y=150, z=100
        ),
        GraphNode(
            id="fraud_alerts",
            name="fraud_alerts",
            type="fact",
            entity="fraud",
            size=35,
            color="#ff4757",
            row_count=25000,
            metrics=["risk_score", "amount_involved"],
            x=-100, y=-100, z=150
        ),
        GraphNode(
            id="loans",
            name="loans",
            type="dimension",
            entity="loan",
            size=38,
            color="#9d4edd",
            row_count=800000,
            metrics=["principal", "interest_rate"],
            x=-150, y=0, z=-100
        ),
        GraphNode(
            id="cards",
            name="cards",
            type="dimension",
            entity="card",
            size=42,
            color="#ff6b9d",
            row_count=4000000,
            metrics=["credit_limit", "balance"],
            x=150, y=-50, z=100
        )
    ]
    
    # Demo edges
    edges = [
        GraphEdge(source="transactions", target="accounts", type="foreign_key"),
        GraphEdge(source="transactions", target="customers", type="foreign_key"),
        GraphEdge(source="transactions", target="branches", type="foreign_key"),
        GraphEdge(source="accounts", target="customers", type="foreign_key"),
        GraphEdge(source="fraud_alerts", target="transactions", type="foreign_key"),
        GraphEdge(source="loans", target="customers", type="foreign_key"),
        GraphEdge(source="cards", target="accounts", type="foreign_key")
    ]
    
    return Graph(nodes=nodes, edges=edges)
