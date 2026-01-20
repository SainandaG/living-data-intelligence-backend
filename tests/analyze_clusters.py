"""
Detailed NetworkX Cluster Analysis
-----------------------------------
Shows which tables are in each cluster and analyzes WHY based on relationships.

Usage:
    python analyze_clusters.py conn_1
"""

import requests
import sys
import json

def analyze_networkx_clusters(connection_id: str):
    """Detailed analysis of NetworkX clustering results"""
    
    base_url = "http://localhost:8001"
    
    print("=" * 80)
    print("🧠 NetworkX Cluster Analysis")
    print("=" * 80)
    print(f"\nConnection ID: {connection_id}\n")
    
    # Get NetworkX clustering
    response = requests.post(
        f"{base_url}/api/ai/optimize",
        json={
            "connection_id": connection_id,
            "active": True,
            "method": "networkx"
        }
    )
    response.raise_for_status()
    result = response.json()
    
    clusters = result.get("layout_clusters", {})
    cluster_count = result.get("cluster_count", 0)
    
    # Get schema to analyze relationships
    schema_response = requests.get(f"{base_url}/api/schema/{connection_id}")
    schema_response.raise_for_status()
    schema = schema_response.json()
    
    # Build relationship map
    table_map = {t['name']: t for t in schema.get('tables', [])}
    
    # Group by cluster
    cluster_groups = {}
    for table, cluster in clusters.items():
        if cluster not in cluster_groups:
            cluster_groups[cluster] = []
        cluster_groups[cluster].append(table)
    
    print(f"✅ Found {cluster_count} clusters\n")
    
    # Analyze each cluster
    for cluster_name in sorted(cluster_groups.keys()):
        tables = cluster_groups[cluster_name]
        print("=" * 80)
        print(f"📦 {cluster_name.upper()}")
        print("=" * 80)
        print(f"Tables: {len(tables)}")
        print(f"Members: {', '.join(sorted(tables))}\n")
        
        # Analyze relationships within cluster
        print("🔗 Relationships within this cluster:")
        found_relationships = False
        
        for table in tables:
            table_data = table_map.get(table, {})
            fks = table_data.get('foreign_keys', [])
            
            for fk in fks:
                target = fk.get('referenced_table') or fk.get('target_table')
                if target in tables:
                    print(f"  • {table} → {target} (via {fk.get('column')})")
                    found_relationships = True
        
        if not found_relationships:
            print("  • No internal relationships (isolated table or view)")
        
        # Show external connections
        print("\n🌐 External connections:")
        external_found = False
        
        for table in tables:
            table_data = table_map.get(table, {})
            fks = table_data.get('foreign_keys', [])
            
            for fk in fks:
                target = fk.get('referenced_table') or fk.get('target_table')
                if target not in tables:
                    target_cluster = clusters.get(target, 'unknown')
                    print(f"  • {table} → {target} ({target_cluster})")
                    external_found = True
        
        if not external_found:
            print("  • No external connections")
        
        print()
    
    # Summary
    print("=" * 80)
    print("📊 CLUSTER ANALYSIS SUMMARY")
    print("=" * 80)
    
    # Find the largest clusters
    sorted_clusters = sorted(cluster_groups.items(), key=lambda x: len(x[1]), reverse=True)
    
    print("\n🏆 Largest Clusters:")
    for cluster_name, tables in sorted_clusters[:5]:
        print(f"  • {cluster_name}: {len(tables)} tables")
    
    # Find isolated tables
    isolated = [c for c, t in cluster_groups.items() if len(t) == 1]
    print(f"\n🔸 Isolated Tables: {len(isolated)} clusters with 1 table each")
    if isolated:
        print(f"   (These are likely views or tables with no FK relationships)")
    
    # Calculate connectivity
    total_internal_links = 0
    total_external_links = 0
    
    for cluster_name, tables in cluster_groups.items():
        for table in tables:
            table_data = table_map.get(table, {})
            fks = table_data.get('foreign_keys', [])
            
            for fk in fks:
                target = fk.get('referenced_table') or fk.get('target_table')
                if target in tables:
                    total_internal_links += 1
                else:
                    total_external_links += 1
    
    print(f"\n🔗 Relationship Stats:")
    print(f"   Internal links (within clusters): {total_internal_links}")
    print(f"   External links (between clusters): {total_external_links}")
    
    if total_internal_links + total_external_links > 0:
        cohesion = (total_internal_links / (total_internal_links + total_external_links)) * 100
        print(f"   Cluster cohesion: {cohesion:.1f}%")
        print(f"   (Higher = better clustering)")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        connection_id = sys.argv[1]
    else:
        connection_id = input("Enter connection_id (default: conn_1): ").strip() or "conn_1"
    
    try:
        analyze_networkx_clusters(connection_id)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
