"""
Internal Node API - Provides detailed column-level cluster data for Latent World visualization
"""
from fastapi import APIRouter, HTTPException, Depends
from app.services.rbac_service import require_role
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/internal-node/clusters/{connection_id}/{table_name}")
async def get_table_clusters(connection_id: str, table_name: str, _user: dict = Depends(require_role("viewer"))):
    """
    Get column clusters for a specific table (for Internal Node / Latent World visualization)
    
    Groups columns by semantic meaning:
    - Identity: Primary keys, IDs
    - Temporal: Dates, timestamps
    - Numeric: Quantities, amounts, counts
    - Text: Names, descriptions
    - Reference: Foreign keys
    """
    try:
        # Use Schema Analyzer to get column info (handles caching and DB abstraction)
        from app.services.schema_analyzer import schema_analyzer
        
        # Try getting cached schema first
        schema = schema_analyzer.get_analysis_result(connection_id)
        
        # If not cached, trigger analysis (this is async)
        if not schema:
            schema = await schema_analyzer.analyze_schema(connection_id)
            
        if not schema:
            return {
                "status": "error",
                "error": f"Could not analyze schema for connection {connection_id}",
                "clusters": []
            }

        # Find the specific table
        # Handle case sensitivity by checking lower() if direct match fails
        target_table = next((t for t in schema.tables if t.name == table_name), None)
        if not target_table:
            target_table = next((t for t in schema.tables if t.name.lower() == table_name.lower()), None)

        if not target_table:
            return {
                "status": "error",
                "error": f"Table {table_name} not found in schema",
                "clusters": []
            }
        
        # Convert to dict format expected by _create_column_clusters
        columns = [
            {
                'name': col.name,
                'type': col.type,
                'is_primary_key': col.is_pk,
                'is_foreign_key': col.is_fk
            }
            for col in target_table.columns
        ]
        
        # Group columns into semantic clusters
        clusters = _create_column_clusters(columns, table_name)

        # FETCH REAL ROW DATA FOR VOXEL VISUALIZATION
        # The user wants to see actual values (Transactions, Timestamps) in the grid
        try:
            from app.services.drill_down import drill_down_service
            # Fetch a sample of rows (e.g. 100) to populate the voxels
            sample_data = await drill_down_service.get_table_sample(connection_id, table_name, limit=100)
            rows = sample_data.get('records', [])
            
            # Attach rows to clusters (or distribute them)
            # For now, we attach the full sample to the response so the frontend can map it
            # We also update the cluster 'count' to reflect actual row count if possible, 
            # though clusters are currently column-based. 
            # Strategy: The Frontend will receive 'sample_rows' and map them to voxels.
        except Exception as e:
            logger.warning(f"Could not fetch sample rows for {table_name}: {e}")
            rows = []

        logger.info(f" Generated {len(clusters)} clusters for {table_name} with {len(rows)} sample rows")
        
        return {
            "status": "success",
            "table_name": table_name,
            "total_columns": len(columns),
            "clusters": clusters,
            "sample_rows": rows  # NEW: Real data for voxels
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Error generating clusters for {table_name}: {e}")
        return {
            "status": "error",
            "error": str(e),
            "clusters": _get_fallback_clusters(table_name)
        }


def _create_column_clusters(columns: list, table_name: str) -> list:
    """
    Intelligently group columns into semantic clusters
    """
    # Initialize cluster groups
    identity_cols = []
    temporal_cols = []
    numeric_cols = []
    text_cols = []
    reference_cols = []
    boolean_cols = []
    
    for col in columns:
        col_name = col.get('name', '').lower()
        col_type = col.get('type', '').lower()
        
        # Identity cluster (IDs, primary keys)
        if any(x in col_name for x in ['_id', 'id_', 'key']) or col.get('is_primary_key'):
            identity_cols.append(col)
        
        # Temporal cluster (dates, timestamps)
        elif any(x in col_type for x in ['date', 'time', 'timestamp']):
            temporal_cols.append(col)
        
        # Reference cluster (foreign keys)
        elif col.get('is_foreign_key') or '_fk' in col_name:
            reference_cols.append(col)
        
        # Boolean cluster
        elif 'bool' in col_type or 'bit' in col_type or any(x in col_name for x in ['is_', 'has_', 'active']):
            boolean_cols.append(col)
        
        # Numeric cluster (int, decimal, float)
        elif any(x in col_type for x in ['int', 'decimal', 'float', 'numeric', 'double']):
            numeric_cols.append(col)
        
        # Text cluster (varchar, text, char)
        else:
            text_cols.append(col)
    
    # Build cluster objects
    clusters = []
    
    if identity_cols:
        clusters.append({
            "id": "identity",
            "name": "Identity",
            "columns": [c['name'] for c in identity_cols],
            "color": "#00d4ff",  # Cyan
            "type": "identity",
            "count": len(identity_cols)
        })
    
    if temporal_cols:
        clusters.append({
            "id": "temporal",
            "name": "Temporal",
            "columns": [c['name'] for c in temporal_cols],
            "color": "#ffd700",  # Gold
            "type": "temporal",
            "count": len(temporal_cols)
        })
    
    if reference_cols:
        clusters.append({
            "id": "reference",
            "name": "References",
            "columns": [c['name'] for c in reference_cols],
            "color": "#bf00ff",  # Purple
            "type": "reference",
            "count": len(reference_cols)
        })
    
    if numeric_cols:
        clusters.append({
            "id": "numeric",
            "name": "Numeric",
            "columns": [c['name'] for c in numeric_cols],
            "color": "#00ff88",  # Green
            "type": "numeric",
            "count": len(numeric_cols)
        })
    
    if text_cols:
        clusters.append({
            "id": "text",
            "name": "Text",
            "columns": [c['name'] for c in text_cols],
            "color": "#ff6b6b",  # Red
            "type": "text",
            "count": len(text_cols)
        })
    
    if boolean_cols:
        clusters.append({
            "id": "boolean",
            "name": "Flags",
            "columns": [c['name'] for c in boolean_cols],
            "color": "#ff9500",  # Orange
            "type": "boolean",
            "count": len(boolean_cols)
        })
    
    return clusters


def _get_fallback_clusters(table_name: str) -> list:
    """
    Fallback clusters when real data unavailable
    """
    return [
        {
            "id": "identity",
            "name": "Identity",
            "columns": [f"{table_name}_id", "name"],
            "color": "#00d4ff",
            "type": "identity",
            "count": 2
        },
        {
            "id": "temporal",
            "name": "Temporal",
            "columns": ["created_at", "updated_at"],
            "color": "#ffd700",
            "type": "temporal",
            "count": 2
        }
    ]

