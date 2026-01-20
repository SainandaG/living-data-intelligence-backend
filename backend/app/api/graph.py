from fastapi import APIRouter, HTTPException
from app.services.graph_generator import graph_generator

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
        neural_core.update_schema_context({'tables': graph.get('nodes', [])})
        
        # 2. Get Real-Time Metrics (DB Traffic)
        real_metrics_data = await realtime_monitor.get_realtime_data(connection_id)
        live_metrics = real_metrics_data.get('data', {})
        health_report = real_metrics_data.get('health', {'state': 'unknown'})
        
        # 3. Get Neural Core Status (Schema Intelligence)
        core_metrics = neural_core.get_core_metrics()
        
        # 4. Enrich Nodes & Edges with "Truth-Preserving" Math (Director Formulation)
        import math
        
        # Mathematical Constants for Glow Logic
        ALPHA = 0.8  # Weight for Row Count (N) - Logarithmic
        BETA = 0.6   # Weight for Centrality/Importance (C) - Linear
        GAMMA = 1.2  # Weight for Relationship Count (R)
        DELTA = 0.8  # Weight for Semantic Similarity (S)

        enriched_nodes = []
        for node in graph.get('nodes', []) or []:
            try:
                # --- Node Glow Formula ---
                # NodeGlow(v) = alpha * log(N + 1) + beta * C
                
                # Defensive type casting
                try:
                    row_count = int(node.get('row_count', 0) or 0)
                except:
                    row_count = 0
                    
                # 1. Logarithmic Term (N)
                n_term = math.log10(max(1, row_count + 1))
                
                # 2. Centrality Term (C)
                raw_importance = neural_core.gravity_store.get(node.get('name'), 1.0)
                if isinstance(raw_importance, str):
                    importance_map = {"critical": 3.0, "high": 2.2, "medium": 1.5, "low": 0.8}
                    importance = importance_map.get(raw_importance.lower(), 1.0)
                else:
                    importance = float(raw_importance)
                
                c_term = importance
                
                # 3. Final Glow Value
                node_glow = (ALPHA * n_term) + (BETA * c_term)
                
                # Calculate vitality
                vitality = min(100, (n_term * 20) + (importance * 5))
                
                # Cluster processing
                table_name = node.get('name')
                cluster = cluster_assignments.get(table_name) if table_name and cluster_assignments else None
                
                if cluster:
                    node['cluster'] = cluster
                    new_color = graph_generator.get_cluster_color(cluster, clustering_method)
                    node['color'] = new_color
                
                node.update({
                    'vitality': int(vitality),
                    'importance_score': importance,
                    'node_glow': round(node_glow, 2)
                })
            except Exception as inner_e:
                print(f"⚠️ Error processing node {node.get('name', '?')}: {inner_e}")
                # Fallback
                node.update({'vitality': 20, 'importance_score': 1.0, 'node_glow': 1.0})
                
            enriched_nodes.append(node)
            
        graph['nodes'] = enriched_nodes
        
        # --- Edge Glow Formula ---
        # EdgeGlow(u, v) = gamma * log(R + 1) + delta * cos(theta)
        
        enriched_edges = []
        for edge in graph.get('edges', []) or []:
            try:
                # Proxy for R (Relationship Count)
                e_type = edge.get('type')
                if e_type == 'foreign_key':
                    r_proxy = 100 
                    semantic_sim = 1.0
                elif e_type == 'ai_predicted':
                    r_proxy = 10
                    semantic_sim = float(edge.get('confidence', 0.5))
                else:
                    r_proxy = 1 
                    semantic_sim = float(edge.get('link_strength', 0.1))
                    
                # 1. Log Term
                r_term = math.log10(r_proxy + 1)
                
                # 2. Final Edge Glow
                edge_glow = (GAMMA * r_term) + (DELTA * semantic_sim)
                
                edge['edge_glow'] = round(edge_glow, 2)
            except Exception as inner_e:
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
