from fastapi import APIRouter, HTTPException
from app.services.graph_generator import graph_generator
import math

router = APIRouter()

@router.get("/graph/{connection_id}")
async def get_graph(connection_id: str):
    """Generate 3D graph from schema with Neural Core Intelligence"""
    try:
        print(f"🎨 Generating graph for connection: {connection_id}")
        
        # Get cluster assignments BEFORE generating graph
        from app.services.cluster_store import cluster_store
        cluster_assignments = cluster_store.get_clusters(connection_id)
        clustering_method = cluster_store.get_method(connection_id)
        
        # Generate graph with cluster-aware positioning
        graph = await graph_generator.generate_graph(connection_id, cluster_assignments, clustering_method)
        
        # --- Neural Core Integration ---
        from app.services.neural_core import neural_core
        from app.services.realtime_monitor import realtime_monitor
        
        # 1. Feed the Schema for Active Scanning
        neural_core.update_schema_context({'tables': graph.get('nodes', [])}, connection_id=connection_id)
        
        # FORCE: Run immediate analysis cycle to populate stats
        # Tick the core once for every table (or max 50) so "Patterns" are counted instantly
        import asyncio
        for i in range(min(50, len(graph.get('nodes', [])))):
             await neural_core.process_signal(f"init_tick_{i}", 1.0)
        
        # 2. Get Real-Time Metrics (DB Traffic)
        real_metrics_data = await realtime_monitor.get_realtime_data(connection_id)
        live_metrics = real_metrics_data.get('data', {})
        health_report = real_metrics_data.get('health', {'state': 'unknown'})
        
        # 3. Get Neural Core Status (Schema Intelligence)
        core_metrics = neural_core.get_core_metrics()
        
        # 4. Enrich Nodes & Edges via GlowCalculator Service
        from visualization.glow_calculator import GlowCalculator
        glow_calc = GlowCalculator()
        
        # Prepare data for calculator
        # We need to pass raw lists, the calculator handles the logic (and feature flags)
        nodes_for_calc = graph.get('nodes', [])
        edges_for_calc = graph.get('edges', [])
        
        # Add necessary properties for calculator if missing (mapping API format to calculator expectation)
        for n in nodes_for_calc:
            n.setdefault('record_count', n.get('row_count', 0))
            # Inject neural importance if available
            raw_imp = neural_core.gravity_store.get(n.get('name'), 1.0)
            if isinstance(raw_imp, str):
                 importance_map = {"critical": 3.0, "high": 2.2, "medium": 1.5, "low": 0.8}
                 n['centrality'] = importance_map.get(raw_imp.lower(), 1.0)
            else:
                 n['centrality'] = float(raw_imp)

        # Batch Calculate
        glow_results = glow_calc.batch_calculate(nodes_for_calc, edges_for_calc)
        node_glow_map = glow_results.get('node_glows', {})
        edge_glow_map = glow_results.get('edge_glows', {})

        # Apply results back to graph
        enriched_nodes = []
        for node in nodes_for_calc:
            try:
                # Apply Glow
                node_id = node.get('id')
                node['node_glow'] = round(node_glow_map.get(node_id, 1.0), 2)
                
                # Setup visual properties
                # ... other vitality/cluster logic preserved ...
                table_name = node.get('name')
                cluster = cluster_assignments.get(table_name) if table_name and cluster_assignments else None
                
                if cluster:
                    node['cluster'] = cluster
                    new_color = graph_generator.get_cluster_color(cluster, clustering_method)
                    node['color'] = new_color
                
                # Fallback vitality calculation (or move to calculator later)
                # Maintaining simple visual size logic here for now
                n_term = math.log10(max(1, int(node.get('row_count', 0) or 0) + 1))
                vitality = min(100, (n_term * 20) + (node.get('centrality', 1.0) * 5))
                node['vitality'] = int(vitality)
                node['importance_score'] = node.get('centrality', 1.0)

            except Exception as inner_e:
                print(f"⚠️ Error processing node {node.get('name', '?')}: {inner_e}")
                node.update({'vitality': 20, 'importance_score': 1.0, 'node_glow': 1.0})
            
            enriched_nodes.append(node)
            
        graph['nodes'] = enriched_nodes
        
        enriched_edges = []
        for edge in edges_for_calc:
             try:
                 edge_id = edge.get('id')
                 edge['edge_glow'] = round(edge_glow_map.get(edge_id, 1.0), 2)
             except:
                 edge['edge_glow'] = 1.0
             enriched_edges.append(edge)

        graph['edges'] = enriched_edges
        graph['neural_core'] = {
            'status': core_metrics['status'],
            'health': health_report,
            'metrics': {
                'transaction_rate': live_metrics.get('transaction_rate', 0),
                'fraud_alerts': live_metrics.get('fraud_alerts', 0),
                'average_amount': live_metrics.get('average_amount', 0),
                'failed_transactions': live_metrics.get('failed_transactions', 0)
            },
            'ai_stats': core_metrics # Pass full core stats (growth, patterns)
        }
        
        return graph
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        
        # Check if it's a "connection not found" error
        if "not found" in error_msg.lower() or "connection" in error_msg.lower():
            # Handle missing connection gracefully with a 404
            raise HTTPException(status_code=404, detail=f"Connection {connection_id} not found. Please re-connect.")
            
        stack_trace = traceback.format_exc()
        print(f"⚠️ Error generating graph: {error_msg}")
        
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

@router.post("/recalculate-gravity")
async def recalculate_gravity(payload: dict):
    """Manually trigger neural core recalculation"""
    try:
        from app.services.neural_core import neural_core
        print("🔄 Manual Recalculation Triggered")
        await neural_core.process_signal("manual_recalc", 1.0)
        return {"status": "triggered", "message": "Neural Core recalculation started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
