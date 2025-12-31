from fastapi import APIRouter, HTTPException
from app.services.graph_generator import graph_generator

router = APIRouter()

@router.get("/graph/{connection_id}")
async def get_graph(connection_id: str):
    """Generate 3D graph from schema with Neural Core Intelligence"""
    try:
        print(f"🎨 Generating graph for connection: {connection_id}")
        graph = await graph_generator.generate_graph(connection_id)
        
        # --- Neural Core Integration ---
        from app.services.graph_intelligence import graph_intelligence
        
        # 1. Get Live Metrics (In a real app, fetch from MetricsService)
        # For now, we simulate metrics based on graph size to seed the intelligence engine
        node_count = len(graph.get('nodes', []))
        mock_metrics = {
            'transaction_rate': node_count * 15,  # Fake activity
            'fraud_alerts': 2 if node_count > 10 else 0,
            'failed_transactions': 5
        }
        
        # 2. Analyze Global Health
        health_report = graph_intelligence.analyze_graph_health(connection_id, mock_metrics)
        
        # 3. Enrich Nodes with Vitality
        enriched_nodes = []
        for node in graph.get('nodes', []):
            vitality_data = graph_intelligence.calculate_node_vitality(node, mock_metrics)
            # Merge vitality data into node
            node.update(vitality_data)
            # Add Neural Score
            node['importance_score'] = vitality_data['vitality'] / 10.0 # 0-10 scale
            enriched_nodes.append(node)
            
        graph['nodes'] = enriched_nodes
        graph['neural_core'] = {
            'status': 'active',
            'health': health_report,
            'metrics': mock_metrics
        }
        
        return graph
        
    except Exception as e:
        import traceback
        error_msg = f"Error generating graph: {str(e)}"
        stack_trace = traceback.format_exc()
        print(f"⚠️ {error_msg}")
        
        # Log to file for debugging
        try:
            with open("backend_error.log", "a") as f:
                import datetime
                f.write(f"[{datetime.datetime.now()}] {connection_id}: {error_msg}\n")
                f.write(f"Stack Trace:\n{stack_trace}\n")
                f.write("-" * 50 + "\n")
        except:
            pass
            
        # Re-raise error to show real status
        raise HTTPException(status_code=500, detail=str(e))
