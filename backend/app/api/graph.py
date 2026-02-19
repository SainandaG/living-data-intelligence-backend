from fastapi import APIRouter, HTTPException
from app.services.graph_generator import graph_generator
from typing import Dict, List, Any
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
        
        # 1. Feed the Schema for Active Scanning (Include Edges for Topology)
        neural_core.update_schema_context(
            {'tables': graph.get('nodes', [])}, 
            connection_id=connection_id,
            edges=graph.get('edges', [])
        )
        
        # REMOVED: Synchronous init ticks that block graph generation.
        # The core will evolve naturally via background signals.
        
        # 2. Get Real-Time Metrics (DB Traffic)
        real_metrics_data = await realtime_monitor.get_realtime_data(connection_id)
        live_metrics = real_metrics_data.get('data', {})
        health_report = real_metrics_data.get('health', {'state': 'unknown'})
        
        # 3. Get Neural Core Status (Schema Intelligence)
        core_metrics = await neural_core.get_core_metrics(connection_id)
        
        # 4. Initialize Latent Space Service
        from app.services.latent_space_service import latent_space_service
        from app.services.causal_intelligence import causal_intelligence
        
        # 4.5 Fetch WEZU Node Specific Metrics (Data-Driven Mapping)
        wezu_node_data = await realtime_monitor.get_wezu_node_data(connection_id)
        
        # 5. Enrich Nodes & Edges via GlowCalculator Service
        from visualization.glow_calculator import GlowCalculator
        glow_calc = GlowCalculator()
        
        # Prepare data for calculator
        nodes_for_calc = graph.get('nodes', [])
        edges_for_calc = graph.get('edges', [])
        
        # Add necessary properties for calculator...
        for n in nodes_for_calc:
            n.setdefault('record_count', n.get('row_count', 0))
            
            # Inject WEZU Specific Metrics for Latent Mapping
            node_name = n.get('name')
            if node_name in wezu_node_data:
                n.update(wezu_node_data[node_name])
            
            gravity_map = neural_core.gravity_stores.get(connection_id, {})
            raw_imp = gravity_map.get(n.get('name'), 1.0)
            if isinstance(raw_imp, str):
                 importance_map = {"critical": 3.0, "high": 2.2, "medium": 1.5, "low": 0.8}
                 n['centrality'] = importance_map.get(raw_imp.lower(), 1.0)
            else:
                 n['centrality'] = float(raw_imp)

        # Batch Calculate Glow
        glow_results = glow_calc.batch_calculate(nodes_for_calc, edges_for_calc)
        node_glow_map = glow_results.get('node_glows', {})
        edge_glow_map = glow_results.get('edge_glows', {})

        # Apply results back to graph
        enriched_nodes = []
        for node in nodes_for_calc:
            try:
                node_id = node.get('id')
                node['node_glow'] = round(node_glow_map.get(node_id, 1.0), 2)
                
                table_name = node.get('name')
                cluster = cluster_assignments.get(table_name) if table_name and cluster_assignments else None
                
                if cluster:
                    node['cluster'] = cluster
                    new_color = graph_generator.get_cluster_color(cluster, clustering_method)
                    node['color'] = new_color
                
                n_term = math.log10(max(1, int(node.get('row_count', 0) or 0) + 1))
                
                # Legacy vitality calculation removed - now using unified service below
                
                # Use Neural Core for structural importance, but enrich with GNN
                node['importance_score'] = node.get('centrality', 1.0)
                
                try:
                    try:
                        from backend.ml.graph_neural_core import graph_neural_core
                    except ImportError:
                        try:
                            from ml.graph_neural_core import graph_neural_core
                        except ImportError:
                            # Final resort if running from a nested context
                            import sys
                            import os
                            sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
                            from backend.ml.graph_neural_core import graph_neural_core
                    
                    # Pass the enriched node data to get GNN-backed importance
                    node['importance_score'] = graph_neural_core.predict_importance(node.get('id'), node.get('type', 'table'), node)
                except Exception as gnn_e:
                    print(f"⚠️ GNN Inference skipped for {node.get('name')}: {gnn_e}")

                # --- UNIFIED MASTER SYNC (Specification 1.0) ---
                from app.services.graph_intelligence import graph_intelligence
                from app.services.neural_core import neural_core
                
                # Pre-calculate total connections for Entropy synchronization
                total_connections = sum(neural_core.in_degrees.get(connection_id, {}).values()) + \
                                    sum(neural_core.out_degrees.get(connection_id, {}).values())
                
                # Fetch local degrees from neural core for high-fidelity math
                t_name = node.get('name', '')
                in_deg = neural_core.in_degrees.get(connection_id, {}).get(t_name, 0)
                out_deg = neural_core.out_degrees.get(connection_id, {}).get(t_name, 0)
                
                auth_metrics = graph_intelligence.get_authenticated_metrics(
                    t_name,
                    node.get('row_count', 0),
                    in_deg,
                    out_deg,
                    total_system_connections=total_connections
                )
                
                # Apply authenticated values to the node
                node['vitality'] = auth_metrics['vitality']
                node['gravity_pull'] = auth_metrics['pull_factor']
                node['importance_score'] = auth_metrics['gravity'] # Use authenticated gravity for GNN-level importance
                node['entropy'] = auth_metrics['entropy']

                # --- Autonomous Latent Space Mapping ---
                latent_coords = latent_space_service.calculate_latent_coordinates(
                    node, live_metrics, real_metrics_data.get('anomalies', [])
                )
                node.update(latent_coords)
                
                # UNIFIED COLORING (Preserve original 'color' for main graph, use 'latent_color' for Galaxy)
                node['latent_color'] = latent_space_service._get_semantic_color(node)

            except Exception as inner_e:
                t_name = node.get('name', 'Unknown')
                print(f"⚠️ Authenticated Enrichment Failed for {t_name}: {inner_e}")
                
                # EMERGENCY REDIRECT: Use Authenticated Engine even in fallback
                from app.services.graph_intelligence import graph_intelligence
                auth = graph_intelligence.get_authenticated_metrics(t_name, 0, 0, 0)
                
                node.update({
                    'vitality': auth['vitality'], 
                    'gravity_pull': auth['pull_factor'],
                    'importance_score': auth['gravity'], 
                    'node_glow': 1.0,
                    'latent_x': (hash(node.get('id', 'default')) % 10000) - 5000,
                    'latent_y': 100, 'latent_z': 0
                })
            
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
        
        # --- Manifold Surface Parameters ---
        # Provides the mathematical terrain data for the frontend
        graph['latent_manifold'] = latent_space_service.generate_manifold_data(enriched_nodes)
        
        # --- Causal History (Global Narrative Thread) ---
        graph['intelligence_stream'] = causal_intelligence.causal_history[-10:] if causal_intelligence.causal_history else []

        graph['neural_core'] = {
            'status': core_metrics['status'],
            'health': health_report,
            'metrics': {
                'transaction_rate': live_metrics.get('transaction_rate', 0),
                'fraud_alerts': live_metrics.get('fraud_alerts', 0),
                'average_amount': live_metrics.get('average_amount', 0),
                'failed_transactions': live_metrics.get('failed_transactions', 0)
            },
            'ai_stats': core_metrics 
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

@router.get("/graph/neural-metrics/{connection_id}")
async def get_neural_metrics(connection_id: str):
    """Get neural core metrics only (distinct from /api/metrics which returns realtime_monitor data)."""
    try:
        from app.services.neural_core import neural_core
        metrics = await neural_core.get_core_metrics(connection_id)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recalculate-gravity")
async def recalculate_gravity(payload: dict):
    """Manually trigger neural core recalculation"""
    try:
        from app.services.neural_core import neural_core
        conn_id = payload.get("connection_id")
        print(f"🔄 Manual Recalculation Triggered for {conn_id}")
        await neural_core.process_signal("manual_recalc", 1.0, connection_id=conn_id)
        return {"status": "triggered", "message": "Neural Core recalculation started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/graph/cluster-metadata/{connection_id}")
async def get_cluster_metadata(connection_id: str):
    """
    Get cluster metadata for 3D Tables visualization (tier3 lens)
    
    Returns semantic cluster groups with:
    - Cluster names and IDs
    - Table lists for each cluster
    - Colors for visualization
    - 3D positions for layout
    
    Used by ThreeGraph.jsx when currentLens === 'tier3'
    """
    try:
        from app.services.cluster_metadata_service import cluster_metadata_service
        from app.services.schema_analyzer import schema_analyzer
        
        # Get schema for clustering
        schema = await schema_analyzer.analyze_schema(connection_id)
        schema_data = schema.dict() if hasattr(schema, 'dict') else schema.model_dump()
        
        # Generate cluster metadata
        metadata = await cluster_metadata_service.get_cluster_groups(
            connection_id,
            schema_data
        )
        
        return {
            "status": "success",
            "connection_id": connection_id,
            "total_tables": metadata.get("total_tables", 0),
            "total_clusters": metadata.get("total_clusters", 0),
            "clusters": metadata.get("clusters", []),
            "error": metadata.get("error")
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        
        # Return graceful fallback
        return {
            "status": "error",
            "connection_id": connection_id,
            "total_tables": 0,
            "total_clusters": 0,
            "clusters": [],
            "error": str(e)
        }

