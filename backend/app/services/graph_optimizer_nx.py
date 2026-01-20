"""
Graph Optimizer (NetworkX-based)
---------------------------------
Advanced graph-based clustering using NetworkX and Louvain community detection.
This is an ALTERNATIVE to the heuristic-based rl_optimizer.py.

Usage:
    - Louvain algorithm for community detection (clustering)
    - PageRank algorithm for importance ranking
    - EMA-based live adaptation for dynamic weighting
"""

import networkx as nx
import community as community_louvain  # python-louvain
import numpy as np
from typing import Dict, List, Any


class SchemaAnalyzer:
    """
    One-time structural analysis using NetworkX graph algorithms.
    Uses actual foreign key relationships instead of naming conventions.
    """
    
    def analyze(self, schema: Dict) -> Dict[str, Any]:
        """
        Analyze database schema structure using graph theory.
        
        Args:
            schema: Schema dictionary with 'tables' list
            
        Returns:
            Dictionary with:
                - clusters: {table_name: cluster_id}
                - base_gravity: {table_name: importance_score}
                - graph: NetworkX graph object
                - num_clusters: Number of detected communities
        """
        G = nx.DiGraph()
        
        # Build graph from schema
        tables = schema.get('tables', [])
        for table in tables:
            table_name = table.get('name')
            G.add_node(
                table_name,
                rows=table.get('row_count', 0),
                cols=len(table.get('columns', []))
            )
            
            # Add edges from foreign keys (actual relationships)
            for fk in table.get('foreign_keys', []):
                target = fk.get('referenced_table') or fk.get('target_table')
                if target:
                    G.add_edge(table_name, target, weight=1.0)
        
        # Add edges for matching column names (weaker connections)
        for i, t1 in enumerate(tables):
            for t2 in tables[i+1:]:
                cols1 = {c['name'] for c in t1.get('columns', []) if c['name'] not in ['id', 'created_at', 'updated_at']}
                cols2 = {c['name'] for c in t2.get('columns', []) if c['name'] not in ['id', 'created_at', 'updated_at']}
                matches = cols1.intersection(cols2)
                if len(matches) >= 2:  # At least 2 matching columns
                    G.add_edge(t1['name'], t2['name'], weight=0.3)
        
        # Compute clusters using Louvain community detection
        try:
            # Convert to undirected for community detection
            G_undirected = G.to_undirected()
            if len(G_undirected.edges()) > 0:
                # FIX: Use random_state for deterministic clustering (same input = same clusters)
                clusters = community_louvain.best_partition(G_undirected, weight='weight', random_state=42)
            else:
                # No edges - fallback to single cluster
                print("⚠️ No edges found, grouping all tables into one cluster")
                clusters = {node: 0 for node in G.nodes()}
        except Exception as e:
            print(f"⚠️ Louvain clustering failed: {e}. Using fallback.")
            # Fallback: all nodes in one cluster
            clusters = {node: 0 for node in G.nodes()}
        
        # Compute importance using PageRank
        try:
            base_importance = nx.pagerank(G)
        except Exception as e:
            print(f"⚠️ PageRank failed: {e}. Using uniform distribution.")
            # Fallback: uniform importance
            num_nodes = len(G.nodes())
            base_importance = {node: 1.0/num_nodes for node in G.nodes()} if num_nodes > 0 else {}
        
        num_clusters = len(set(clusters.values())) if clusters else 0
        
        print(f"🧠 NetworkX Analysis: {len(G.nodes())} tables, {len(G.edges())} relationships, {num_clusters} clusters")
        
        return {
            'clusters': clusters,
            'base_gravity': base_importance,
            'graph': G,
            'num_clusters': num_clusters
        }


class LiveAdapter:
    """
    Real-time adaptation based on live database metrics.
    Uses Exponential Moving Average (EMA) for smooth transitions.
    """
    
    def __init__(self, base_analysis: Dict):
        """
        Initialize with base analysis results.
        
        Args:
            base_analysis: Output from SchemaAnalyzer.analyze()
        """
        self.clusters = base_analysis['clusters']
        self.base_gravity = base_analysis['base_gravity']
        self.live_weights = {}
        self.alpha = 0.3  # EMA smoothing factor (0-1, higher = more reactive)
    
    def update(self, live_metrics: Dict) -> Dict[str, Any]:
        """
        Update gravity based on live database metrics.
        Called periodically (e.g., every 5 seconds) by realtime_monitor.
        
        Args:
            live_metrics: {table_name: {tps, row_growth, query_count}}
            
        Returns:
            Dictionary with updated clusters, gravity, and hot tables
        """
        for table, metrics in live_metrics.items():
            # Calculate activity score (weighted combination)
            activity = (
                metrics.get('tps', 0) * 0.5 +           # Transaction rate
                metrics.get('row_growth', 0) * 0.3 +    # Data growth
                metrics.get('query_count', 0) * 0.2     # Query frequency
            )
            
            # Exponential Moving Average (smooth changes)
            if table not in self.live_weights:
                self.live_weights[table] = activity
            else:
                self.live_weights[table] = (
                    self.alpha * activity +
                    (1 - self.alpha) * self.live_weights[table]
                )
        
        # Combine base PageRank + live activity
        final_gravity = {}
        for table, base in self.base_gravity.items():
            live_boost = self.live_weights.get(table, 0)
            # Boost gravity by up to 100% based on activity
            final_gravity[table] = base * (1 + live_boost)
        
        # Identify hot tables (top 10% by activity)
        if self.live_weights:
            weights_list = list(self.live_weights.values())
            threshold = np.percentile(weights_list, 90) if len(weights_list) > 0 else 0
            hot_tables = [t for t, w in self.live_weights.items() if w > threshold]
        else:
            hot_tables = []
        
        return {
            'clusters': self.clusters,
            'gravity': final_gravity,
            'hot_tables': hot_tables
        }


class GraphOptimizerNX:
    """
    Main integration class for NetworkX-based graph optimization.
    Provides the same interface as rl_optimizer.py for compatibility.
    """
    
    def __init__(self):
        self.analyzer = SchemaAnalyzer()
        self.adapter = None
        self.last_analysis = None
    
    async def on_connection(self, schema: Dict) -> Dict[str, Any]:
        """
        Called when database connects.
        Performs initial graph analysis.
        
        Args:
            schema: Schema dictionary from schema_analyzer
            
        Returns:
            Analysis results with clusters and gravity scores
        """
        print("🧠 Graph Optimizer (NetworkX): Analyzing schema structure...")
        self.last_analysis = self.analyzer.analyze(schema)
        self.adapter = LiveAdapter(self.last_analysis)
        print(f"✅ Found {self.last_analysis['num_clusters']} natural clusters using Louvain algorithm")
        return self.last_analysis
    
    async def on_metrics_update(self, live_metrics: Dict) -> Dict[str, Any]:
        """
        Called periodically by realtime_monitor with live metrics.
        
        Args:
            live_metrics: Current database metrics per table
            
        Returns:
            Updated gravity and cluster information
        """
        if not self.adapter:
            return None
        return self.adapter.update(live_metrics)
    
    async def compute_semantic_clusters(self, schema: Dict) -> Dict[str, str]:
        """
        Backward compatibility method matching rl_optimizer.py interface.
        Returns cluster assignments as strings.
        
        Args:
            schema: Schema dictionary
            
        Returns:
            {table_name: cluster_name} mapping
        """
        if not self.last_analysis:
            analysis = self.analyzer.analyze(schema)
            self.last_analysis = analysis
            self.adapter = LiveAdapter(analysis)
        
        # Convert cluster IDs to string names
        cluster_names = {}
        for table, cluster_id in self.last_analysis['clusters'].items():
            cluster_names[table] = f"nx_cluster_{cluster_id}"
        
        return cluster_names


# Global instance
graph_optimizer_nx = GraphOptimizerNX()
