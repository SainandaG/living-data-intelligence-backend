
import asyncio
import logging
import sys
import os

# Add app to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def debug_graph():
    from app.services.graph_generator import graph_generator
    from app.api.graph import _enrich_node, _apply_glow_to_edges
    from app.visualization.glow_calculator import GlowCalculator
    
    print("DEBUG: Manually simulating graph generation pipeline...")
    
    # 1. Simulate GraphGenerator internals
    connection_id = "conn_1"
    tables = [
        {'name': 'users', 'row_count': 1000},
        {'name': 'orders', 'row_count': 5000}
    ]
    
    nodes = []
    edges = []
    
    print("DEBUG: Building nodes via _build_node_dict...")
    for table in tables:
        # Use the actual internal method if possible or simulate it
        node = graph_generator._build_node_dict(table, 0, 0, 0, 'semantic')
        nodes.append(node)
        print(f"DEBUG: Created node: {node.get('id')} - keys: {list(node.keys())}")
        
    print("DEBUG: Adding edges...")
    # Simulate add_edge logic
    src = "users"
    tgt = "orders"
    edges.append({
        'id': f"{src}->{tgt}",
        'source': src, 'target': tgt,
        'type': 'foreign_key',
        'link_strength': 1.0,
        'opacity': 1.0
    })
    print(f"DEBUG: Created edge: {edges[0].get('id')} - keys: {list(edges[0].keys())}")
    
    # 2. Test Glow Calculation
    print("DEBUG: Testing GlowCalculator.batch_calculate...")
    glow_calc = GlowCalculator()
    glow_results = glow_calc.batch_calculate(nodes, edges)
    print(f"DEBUG: Glow Results: {glow_results.keys()}")
    
    node_glow_map = glow_results.get("node_glows", {})
    edge_glow_map = glow_results.get("edge_glows", {})
    
    # 3. Test Node Enrichment
    print("DEBUG: Testing _enrich_node...")
    for node in nodes:
        print(f"DEBUG: Enriching {node['name']}...")
        await _enrich_node(
            node, 
            connection_id, 
            {}, 
            "heuristic", 
            node_glow_map, 
            {}, 
            {}, 
            {}
        )
    
    # 4. Test Edge Glow
    print("DEBUG: Testing _apply_glow_to_edges...")
    _apply_glow_to_edges(edges, edge_glow_map)
    
    print("DEBUG: Success! Pipeline complete.")

if __name__ == "__main__":
    asyncio.run(debug_graph())
