"""
Cluster Metadata Service - Provides semantic groupings for 3D Tables visualization

This service analyzes database schema and creates logical cluster groups based on:
- Table naming patterns (e.g., customer_*, order_*, product_*)
- Foreign key relationships
- Semantic similarity
- Domain knowledge
"""
from typing import Dict, List, Any, Optional
import re
from collections import defaultdict


class ClusterMetadataService:
    """Generates cluster metadata for 3D Tables lens visualization"""
    
    def __init__(self):
        self.cluster_cache = {}
    
    async def get_cluster_groups(
        self,
        connection_id: str,
        schema_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate cluster groups with metadata for visualization
        
        Args:
            connection_id: Database connection ID
            schema_data: Optional pre-loaded schema data
            
        Returns:
            Dictionary with clusters array containing:
            - id: Unique cluster identifier
            - name: Human-readable cluster name
            - tables: List of table names in this cluster
            - color: Hex color for visualization
            - position: 3D coordinates for cluster placement
            - description: Cluster description
        """
        cache_key = f"clusters:{connection_id}"
        
        # Check cache
        if cache_key in self.cluster_cache:
            return self.cluster_cache[cache_key]
        
        try:
            # Get schema if not provided
            if not schema_data:
                from app.services.schema_analyzer import schema_analyzer
                schema = await schema_analyzer.analyze_schema(connection_id)
                schema_data = schema.dict() if hasattr(schema, 'dict') else schema.model_dump()
            
            tables = schema_data.get('tables', [])
            
            # Generate clusters
            clusters = self._create_semantic_clusters(tables)
            
            # Assign positions and colors
            clusters = self._assign_cluster_positions(clusters)
            clusters = self._assign_cluster_colors(clusters)
            
            result = {
                "connection_id": connection_id,
                "total_tables": len(tables),
                "total_clusters": len(clusters),
                "clusters": clusters
            }
            
            # Cache result
            self.cluster_cache[cache_key] = result
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating cluster metadata: {e}", exc_info=True)
            
            # Return minimal fallback
            return {
                "connection_id": connection_id,
                "total_tables": 0,
                "total_clusters": 0,
                "clusters": [],
                "error": str(e)
            }
    
    def _create_semantic_clusters(self, tables: List[Dict]) -> List[Dict]:
        """
        Create semantic clusters based on table naming patterns and relationships
        
        Strategy:
        1. Group by common prefixes (e.g., customer_*, order_*)
        2. Group by domain keywords (e.g., auth, payment, user)
        3. Create "Core" cluster for central tables
        4. Create "Misc" cluster for ungrouped tables
        """
        clusters_map = defaultdict(list)
        
        # Domain keywords for clustering
        domain_patterns = {
            'user': ['user', 'account', 'profile', 'auth', 'login', 'session'],
            'order': ['order', 'purchase', 'transaction', 'cart', 'checkout'],
            'product': ['product', 'item', 'inventory', 'catalog', 'sku'],
            'customer': ['customer', 'client', 'contact'],
            'payment': ['payment', 'billing', 'invoice', 'subscription'],
            'analytics': ['log', 'event', 'metric', 'stat', 'analytics', 'tracking'],
            'content': ['post', 'article', 'comment', 'media', 'content'],
            'system': ['config', 'setting', 'migration', 'schema', 'metadata']
        }
        
        for table in tables:
            table_name = table.get('name', '').lower()
            assigned = False
            
            # Skip database/hub nodes
            if table_name in ['hub', 'database_core']:
                continue
            
            # Try to match domain patterns
            for domain, keywords in domain_patterns.items():
                if any(keyword in table_name for keyword in keywords):
                    clusters_map[domain].append(table['name'])
                    assigned = True
                    break
            
            # Try prefix-based clustering (e.g., customer_accounts, customer_orders)
            if not assigned:
                prefix_match = re.match(r'^([a-z]+)_', table_name)
                if prefix_match:
                    prefix = prefix_match.group(1)
                    # Only create prefix cluster if it's meaningful (not single table)
                    clusters_map[f"{prefix}_domain"].append(table['name'])
                    assigned = True
            
            # Fallback to misc cluster
            if not assigned:
                clusters_map['misc'].append(table['name'])
        
        # Convert to cluster objects
        clusters = []
        for cluster_id, table_names in clusters_map.items():
            # Skip single-table clusters (they'll be rendered as singles)
            if len(table_names) < 2:
                continue
            
            cluster_name = self._format_cluster_name(cluster_id)
            
            clusters.append({
                "id": cluster_id,
                "name": cluster_name,
                "tables": table_names,
                "table_count": len(table_names),
                "description": f"{cluster_name} domain tables"
            })
        
        return clusters
    
    def _format_cluster_name(self, cluster_id: str) -> str:
        """Format cluster ID into human-readable name"""
        # Remove _domain suffix
        name = cluster_id.replace('_domain', '')
        
        # Capitalize
        name = name.replace('_', ' ').title()
        
        return name
    
    def _assign_cluster_positions(self, clusters: List[Dict]) -> List[Dict]:
        """
        Assign 3D positions to clusters in a circular layout
        
        Positions clusters in a circle around the origin for better visibility
        """
        num_clusters = len(clusters)
        
        if num_clusters == 0:
            return clusters
        
        # Layout parameters
        radius = 3000  # Distance from center
        height = 0     # Y position (ground level)
        
        for i, cluster in enumerate(clusters):
            # Calculate angle for circular layout
            angle = (2 * 3.14159 * i) / num_clusters
            
            x = radius * __import__('math').cos(angle)
            z = radius * __import__('math').sin(angle)
            
            cluster['position'] = {
                "x": round(x, 2),
                "y": height,
                "z": round(z, 2)
            }
        
        return clusters
    
    def _assign_cluster_colors(self, clusters: List[Dict]) -> List[Dict]:
        """
        Assign colors to clusters based on domain
        
        Uses semantic color mapping for better visual distinction
        """
        color_map = {
            'user': '#4CAF50',      # Green - growth/users
            'customer': '#2196F3',  # Blue - trust/customers
            'order': '#FF9800',     # Orange - transactions
            'product': '#9C27B0',   # Purple - products
            'payment': '#F44336',   # Red - money/critical
            'analytics': '#00BCD4', # Cyan - data/insights
            'content': '#FFEB3B',   # Yellow - content
            'system': '#607D8B',    # Gray - infrastructure
            'misc': '#94a3b8'       # Slate - uncategorized
        }
        
        for cluster in clusters:
            cluster_id = cluster['id']
            
            # Try to match domain
            matched_color = None
            for domain, color in color_map.items():
                if domain in cluster_id:
                    matched_color = color
                    break
            
            # Fallback to misc color
            cluster['color'] = matched_color or color_map['misc']
        
        return clusters
    
    def clear_cache(self, connection_id: Optional[str] = None):
        """Clear cluster cache for a specific connection or all"""
        if connection_id:
            cache_key = f"clusters:{connection_id}"
            if cache_key in self.cluster_cache:
                del self.cluster_cache[cache_key]
        else:
            self.cluster_cache.clear()


# Global instance
cluster_metadata_service = ClusterMetadataService()
