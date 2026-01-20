"""
Cluster Store - Stores active cluster assignments
"""

class ClusterStore:
    """Simple in-memory store for cluster assignments"""
    
    def __init__(self):
        self.clusters = {}  # connection_id -> {table_name: cluster_name}
        self.methods = {}   # connection_id -> 'heuristic' or 'networkx'
    
    def set_clusters(self, connection_id: str, clusters: dict, method: str = 'heuristic'):
        """Store cluster assignments for a connection"""
        self.clusters[connection_id] = clusters
        self.methods[connection_id] = method
        print(f"📦 Stored {len(clusters)} cluster assignments for {connection_id} ({method} mode)")
        print(f"   Sample clusters: {dict(list(clusters.items())[:3])}")
    
    def get_clusters(self, connection_id: str) -> dict:
        """Get cluster assignments for a connection"""
        result = self.clusters.get(connection_id, {})
        print(f"🔍 Retrieved {len(result)} cluster assignments for {connection_id}")
        if result:
            print(f"   Sample: {dict(list(result.items())[:3])}")
        else:
            print(f"   ⚠️ No clusters found for {connection_id}")
        return result
    
    def get_method(self, connection_id: str) -> str:
        """Get clustering method used"""
        return self.methods.get(connection_id, 'heuristic')
    
    def clear_clusters(self, connection_id: str):
        """Clear cluster assignments for a connection"""
        if connection_id in self.clusters:
            del self.clusters[connection_id]
        if connection_id in self.methods:
            del self.methods[connection_id]
        print(f"🗑️ Cleared cluster assignments for {connection_id}")

# Global instance
cluster_store = ClusterStore()
