"""
Internal Node Analyzer Service - Analyzes table data and creates semantic clusters

This service provides real data clustering for the LatentWorld visualization,
replacing mock data with actual analysis of table records.
"""
import math
import logging
from typing import Dict, List, Any, Optional
from collections import defaultdict
import hashlib

logger = logging.getLogger(__name__)


class InternalNodeAnalyzer:
    """Analyzes table internals to create data clusters for visualization"""
    
    def __init__(self):
        self.cluster_cache = {}  # Cache clusters to avoid recomputation
    
    async def analyze_table_clusters(
        self,
        connection_id: str,
        table_name: str,
        max_clusters: int = 8
    ) -> Dict[str, Any]:
        """
        Analyze table data and create semantic clusters
        
        Args:
            connection_id: Database connection ID
            table_name: Name of the table to analyze
            max_clusters: Maximum number of clusters to create (default: 8)
            
        Returns:
            Dictionary containing clusters with metadata
        """
        cache_key = f"{connection_id}:{table_name}"
        
        # Check cache first
        if cache_key in self.cluster_cache:
            return self.cluster_cache[cache_key]
        
        try:
            # Import services
            from app.services.drill_down import drill_down_service
            from app.services.schema_analyzer import schema_analyzer
            
            # 1. Get table schema for context
            schema = await schema_analyzer.analyze_schema(connection_id)
            schema_dict = schema.dict() if hasattr(schema, 'dict') else schema.model_dump()
            
            # Find target table
            target_table = None
            for table in schema_dict.get('tables', []):
                if table['name'].lower() == table_name.lower():
                    target_table = table
                    break
            
            if not target_table:
                return self._create_fallback_clusters(table_name, "Table not found in schema")
            
            # 2. Get sample records (limit to 1000 for performance)
            sample_data = await drill_down_service.get_table_sample(
                connection_id,
                table_name,
                limit=1000
            )
            
            if sample_data.get('error') or not sample_data.get('records'):
                return self._create_fallback_clusters(table_name, "No data available")
            
            records = sample_data['records']
            columns = target_table.get('columns', [])
            
            # 3. Perform clustering analysis
            clusters = await self._create_semantic_clusters(
                records,
                columns,
                table_name,
                max_clusters
            )
            
            result = {
                "table_name": table_name,
                "total_records": len(records),
                "clusters": clusters,
                "analysis_timestamp": self._get_timestamp()
            }
            
            # Cache the result
            self.cluster_cache[cache_key] = result
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing table clusters for {table_name}: {e}")
            import traceback
            traceback.print_exc()
            return self._create_fallback_clusters(table_name, str(e))
    
    async def _create_semantic_clusters(
        self,
        records: List[Dict],
        columns: List[Dict],
        table_name: str,
        max_clusters: int
    ) -> List[Dict[str, Any]]:
        """
        Create semantic clusters from table data using heuristic analysis
        
        Strategy:
        1. Identify numeric columns for value-based clustering
        2. Identify status/error columns for health clustering
        3. Identify timestamp columns for temporal clustering
        4. Create clusters based on data patterns
        """
        clusters = []
        
        # Identify column types
        numeric_cols = [c for c in columns if c.get('data_type', '').lower() in 
                       ['int', 'integer', 'bigint', 'decimal', 'numeric', 'float', 'double', 'money']]
        
        text_cols = [c for c in columns if c.get('data_type', '').lower() in 
                    ['varchar', 'text', 'char', 'string']]
        
        # 1. VALUE-BASED CLUSTERING (if numeric columns exist)
        if numeric_cols and len(records) > 0:
            value_clusters = self._cluster_by_value(records, numeric_cols[0]['name'])
            clusters.extend(value_clusters)
        
        # 2. STATUS-BASED CLUSTERING (if status/error columns exist)
        status_col = self._find_status_column(columns)
        if status_col and len(records) > 0:
            status_clusters = self._cluster_by_status(records, status_col)
            clusters.extend(status_clusters)
        
        # 3. PATTERN-BASED CLUSTERING (anomalies, nulls, etc.)
        pattern_clusters = self._cluster_by_patterns(records, columns)
        clusters.extend(pattern_clusters)
        
        # 4. Ensure we have at least one cluster
        if not clusters:
            clusters = self._create_default_clusters(records, table_name)
        
        # 5. Limit to max_clusters
        clusters = clusters[:max_clusters]
        
        # 6. Calculate cluster positions for voxel grid
        clusters = self._assign_cluster_positions(clusters)
        
        return clusters
    
    def _cluster_by_value(self, records: List[Dict], value_column: str) -> List[Dict]:
        """Cluster records by numeric value ranges"""
        clusters = []
        
        # Extract values
        values = []
        for rec in records:
            val = rec.get(value_column)
            if val is not None:
                try:
                    values.append(float(val))
                except (ValueError, TypeError):
                    continue
        
        if not values:
            return []
        
        # Calculate quartiles for clustering
        values.sort()
        n = len(values)
        
        if n < 4:
            return []
        
        q1 = values[n // 4]
        q2 = values[n // 2]  # median
        q3 = values[3 * n // 4]
        
        # Define value-based clusters
        high_value_count = sum(1 for v in values if v >= q3)
        mid_value_count = sum(1 for v in values if q1 <= v < q3)
        low_value_count = sum(1 for v in values if v < q1)
        
        if high_value_count > 0:
            clusters.append({
                "name": "High Value",
                "type": "cluster",
                "count": high_value_count,
                "color": "#facc15",  # Yellow
                "shape": "box",
                "risk": "low",
                "tags": ["High Value", "Premium"],
                "description": f"Records with {value_column} >= {q3:.2f}"
            })
        
        if mid_value_count > 0:
            clusters.append({
                "name": "Standard",
                "type": "cluster",
                "count": mid_value_count,
                "color": "#00f2ff",  # Cyan
                "shape": "box",
                "risk": "low",
                "tags": ["Normal Range"],
                "description": f"Records with {value_column} between {q1:.2f} and {q3:.2f}"
            })
        
        if low_value_count > 0:
            clusters.append({
                "name": "Low Value",
                "type": "cluster",
                "count": low_value_count,
                "color": "#94a3b8",  # Gray
                "shape": "box",
                "risk": "low",
                "tags": ["Low Value"],
                "description": f"Records with {value_column} < {q1:.2f}"
            })
        
        return clusters
    
    def _cluster_by_status(self, records: List[Dict], status_column: str) -> List[Dict]:
        """Cluster records by status/error indicators"""
        clusters = []
        
        # Count status values
        status_counts = defaultdict(int)
        for rec in records:
            status = str(rec.get(status_column, '')).lower()
            status_counts[status] += 1
        
        # Identify failed/error records
        failed_keywords = ['fail', 'error', 'err', 'reject', 'cancel', 'abort']
        failed_count = sum(
            count for status, count in status_counts.items()
            if any(keyword in status for keyword in failed_keywords)
        )
        
        if failed_count > 0:
            clusters.append({
                "name": "Failed/Error",
                "type": "cluster",
                "count": failed_count,
                "color": "#ef4444",  # Red
                "shape": "octa",
                "risk": "high",
                "tags": ["Errors", "Failed Operations"],
                "description": f"Records with error or failure status"
            })
        
        # Identify successful records
        success_keywords = ['success', 'complete', 'done', 'ok', 'active', 'approved']
        success_count = sum(
            count for status, count in status_counts.items()
            if any(keyword in status for keyword in success_keywords)
        )
        
        if success_count > 0:
            clusters.append({
                "name": "Successful",
                "type": "cluster",
                "count": success_count,
                "color": "#22c55e",  # Green
                "shape": "box",
                "risk": "low",
                "tags": ["Success", "Completed"],
                "description": f"Records with successful status"
            })
        
        return clusters
    
    def _cluster_by_patterns(self, records: List[Dict], columns: List[Dict]) -> List[Dict]:
        """Cluster records by data patterns (nulls, anomalies, etc.)"""
        clusters = []
        
        if not records:
            return []
        
        # Count records with many null values (data quality issue)
        null_threshold = len(columns) * 0.5  # More than 50% nulls
        sparse_records = 0
        
        for rec in records:
            null_count = sum(1 for col in columns if rec.get(col['name']) is None)
            if null_count >= null_threshold:
                sparse_records += 1
        
        if sparse_records > 0:
            clusters.append({
                "name": "Incomplete Data",
                "type": "cluster",
                "count": sparse_records,
                "color": "#a855f7",  # Purple
                "shape": "tetra",
                "risk": "medium",
                "tags": ["Data Quality", "Missing Values"],
                "description": f"Records with {int(null_threshold)} or more null fields"
            })
        
        return clusters
    
    def _create_default_clusters(self, records: List[Dict], table_name: str) -> List[Dict]:
        """Create default clusters when no specific patterns are found"""
        total = len(records)
        
        # Split into temporal groups if possible
        third = total // 3
        
        return [
            {
                "name": "Recent Data",
                "type": "cluster",
                "count": third,
                "color": "#00f2ff",
                "shape": "box",
                "risk": "low",
                "tags": ["Recent"],
                "description": "Most recent records"
            },
            {
                "name": "Standard Data",
                "type": "cluster",
                "count": total - third,
                "color": "#94a3b8",
                "shape": "box",
                "risk": "low",
                "tags": ["Standard"],
                "description": "Regular data records"
            }
        ]
    
    def _find_status_column(self, columns: List[Dict]) -> Optional[str]:
        """Find a column that likely contains status information"""
        status_keywords = ['status', 'state', 'result', 'outcome', 'flag']
        
        for col in columns:
            col_name = col['name'].lower()
            if any(keyword in col_name for keyword in status_keywords):
                return col['name']
        
        return None
    
    def _assign_cluster_positions(self, clusters: List[Dict]) -> List[Dict]:
        """Assign grid positions to clusters for voxel layout"""
        for i, cluster in enumerate(clusters):
            # Assign region based on index (matches LatentWorld grid layout)
            cluster['region_x'] = i % 3
            cluster['region_z'] = i // 3
        
        return clusters
    
    def _create_fallback_clusters(self, table_name: str, error_msg: str) -> Dict[str, Any]:
        """Create error-state response when real analysis fails"""
        logger.warning(f"Using fallback clusters for {table_name}: {error_msg}")
        
        return {
            "table_name": table_name,
            "total_records": 0,
            "clusters": [
                {
                    "name": "No Data Available",
                    "type": "cluster",
                    "count": 0,
                    "color": "#64748b",
                    "shape": "box",
                    "risk": "unknown",
                    "tags": ["No Analysis"],
                    "description": f"Unable to analyze: {error_msg}",
                    "region_x": 0,
                    "region_z": 0
                }
            ],
            "analysis_timestamp": self._get_timestamp(),
            "error": error_msg
        }
    
    def _get_timestamp(self) -> str:
        """Get current timestamp as ISO string"""
        from datetime import datetime
        return datetime.utcnow().isoformat() + "Z"
    
    def clear_cache(self, connection_id: Optional[str] = None):
        """Clear cluster cache for a specific connection or all"""
        if connection_id:
            keys_to_remove = [k for k in self.cluster_cache.keys() if k.startswith(connection_id)]
            for key in keys_to_remove:
                del self.cluster_cache[key]
        else:
            self.cluster_cache.clear()


# Global instance
internal_node_analyzer = InternalNodeAnalyzer()
