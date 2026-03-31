"""
Drill Down Service

Provides deep-dive analytics for individual tables, including sample data, column stats, and anomaly flags.
"""
import logging
# -*- coding: utf-8 -*-
"""
Drill-Down Service - Enables detailed exploration of individual records
"""
from typing import Dict, Any
from app.services.db_connector import db_connector
logger = logging.getLogger(__name__)

class DrillDownService:
    """Service for drilling down into specific table records"""
    
    async def get_table_sample(self, connection_id: str, table_name: str, limit: int = 100) -> Dict[str, Any]:
        """Get sample records from a table"""
        try:
            connection = db_connector.get_connection(connection_id)
            
            # Defensive Check: Verify table exists in schema context first
            from app.services.schema_analyzer import schema_analyzer
            schema = schema_analyzer.get_analysis_result(connection_id)
            actual_table_name = table_name
            
            if schema:
                # Case-insensitive check
                table_names_lower = {t.name.lower(): t.name for t in schema.tables}
                if table_name.lower() in table_names_lower:
                     actual_table_name = table_names_lower[table_name.lower()]

            if connection['type'] in ['postgresql', 'postgres', 'neon', 'neon_db', 'mysql', 'mariadb']:
                quoted_table = db_connector.quote_identifier(connection_id, actual_table_name)
                query = f"SELECT * FROM {quoted_table} LIMIT {limit}"
                results = await db_connector.query(connection_id, query)
                
                return {
                    'table': table_name,
                    'records': results,
                    'count': len(results)
                }
            elif connection['type'] == 'mongodb':
                # MongoDB collection query
                db = connection['client'][connection['config']['database']]
                collection = db[table_name]
                cursor = collection.find().limit(limit)
                records = list(cursor)
                
                # Convert ObjectId to string
                for record in records:
                    if '_id' in record:
                        record['_id'] = str(record['_id'])
                
                return {
                    'table': table_name,
                    'records': records,
                    'count': len(records)
                }
        except Exception as e:
            logger.info(f"Error getting table sample for {table_name}: {str(e)}")
            return {
                'table': table_name,
                'records': [],
                'count': 0,
                'error': str(e)
            }
    
    async def get_record_by_id(self, connection_id: str, table_name: str, record_id: Any) -> Dict[str, Any]:
        """Get a specific record by ID"""
        try:
            connection = db_connector.get_connection(connection_id)
            
            if connection['type'] in ['postgresql', 'postgres', 'neon', 'neon_db', 'mysql', 'mariadb']:
                # Table Resolver: Case-insensitive check
                actual_table_name = table_name
                from app.services.schema_analyzer import schema_analyzer
                schema = schema_analyzer.get_analysis_result(connection_id)
                if schema:
                    table_names_lower = {t.name.lower(): t.name for t in schema.tables}
                    if table_name.lower() in table_names_lower:
                        actual_table_name = table_names_lower[table_name.lower()]

                # Assume 'id' column exists
                quoted_table = db_connector.quote_identifier(connection_id, actual_table_name)
                # Parameters should be used for the value to prevent injection
                query = f"SELECT * FROM {quoted_table} WHERE id = %s"
                results = await db_connector.query(connection_id, query, (record_id,))
                
                return {
                    'table': actual_table_name,
                    'record': results[0] if results else None
                }
            elif connection['type'] == 'mongodb':
                from bson.objectid import ObjectId
                db = connection['connection']
                collection = db[table_name]
                record = collection.find_one({'_id': ObjectId(record_id)})
                
                if record and '_id' in record:
                    record['_id'] = str(record['_id'])
                
                return {
                    'table': table_name,
                    'record': record
                }
        except Exception as e:
            logger.info(f"Error getting record: {str(e)}")
            return {
                'table': table_name,
                'record': None,
                'error': str(e)
            }
    
    async def get_related_records(self, connection_id: str, table_name: str, record_id: Any, relationship: Dict) -> Dict[str, Any]:
        """Get records related to a specific record through a foreign key"""
        try:
            connection = db_connector.get_connection(connection_id)
            related_table = relationship['referenced_table']
            foreign_key = relationship['column']
            
            if connection['type'] in ['postgresql', 'postgres', 'neon', 'neon_db', 'mysql', 'mariadb']:
                # Table Resolver: Case-insensitive check for related table
                actual_related_table = related_table
                from app.services.schema_analyzer import schema_analyzer
                schema = schema_analyzer.get_analysis_result(connection_id)
                if schema:
                    table_names_lower = {t.name.lower(): t.name for t in schema.tables}
                    if related_table.lower() in table_names_lower:
                        actual_related_table = table_names_lower[related_table.lower()]

                quoted_table = db_connector.quote_identifier(connection_id, actual_related_table)
                quoted_col = db_connector.quote_identifier(connection_id, foreign_key)
                query = f"SELECT * FROM {quoted_table} WHERE {quoted_col} = %s LIMIT 100"
                results = await db_connector.query(connection_id, query, (record_id,))
                
                return {
                    'source_table': table_name,
                    'related_table': actual_related_table,
                    'records': results,
                    'count': len(results)
                }
        except Exception as e:
            logger.info(f"Error getting related records: {str(e)}")
            return {
                'source_table': table_name,
                'related_table': relationship.get('referenced_table'),
                'records': [],
                'count': 0,
                'error': str(e)
            }
    
    async def search_table(self, connection_id: str, table_name: str, search_column: str, search_value: str, limit: int = 50) -> Dict[str, Any]:
        """Search for records in a table"""
        try:
            connection = db_connector.get_connection(connection_id)
            
            if connection['type'] in ['postgresql', 'postgres', 'neon', 'neon_db', 'mysql', 'mariadb']:
                # Table Resolver: Case-insensitive check
                actual_table_name = table_name
                from app.services.schema_analyzer import schema_analyzer
                schema = schema_analyzer.get_analysis_result(connection_id)
                if schema:
                    table_names_lower = {t.name.lower(): t.name for t in schema.tables}
                    if table_name.lower() in table_names_lower:
                        actual_table_name = table_names_lower[table_name.lower()]

                quoted_table = db_connector.quote_identifier(connection_id, actual_table_name)
                quoted_col = db_connector.quote_identifier(connection_id, search_column)
                query = f"SELECT * FROM {quoted_table} WHERE {quoted_col} LIKE %s LIMIT {limit}"
                results = await db_connector.query(connection_id, query, (f"%{search_value}%",))
                
                return {
                    'table': actual_table_name,
                    'search_column': search_column,
                    'search_value': search_value,
                    'records': results,
                    'count': len(results)
                }
            elif connection['type'] == 'mongodb':
                db = connection['connection']
                collection = db[table_name]
                cursor = collection.find({search_column: {'$regex': search_value, '$options': 'i'}}).limit(limit)
                records = list(cursor)
                
                for record in records:
                    if '_id' in record:
                        record['_id'] = str(record['_id'])
                
                return {
                    'table': table_name,
                    'search_column': search_column,
                    'search_value': search_value,
                    'records': records,
                    'count': len(records)
                }
        except Exception as e:
            logger.info(f"Error searching table: {str(e)}")
            return {
                'table': table_name,
                'records': [],
                'count': 0,
                'error': str(e)
            }
    
    async def get_clustered_records(self, connection_id: str, table_name: str, column: str) -> Dict[str, Any]:
        """
        Get records clustered in 3D space using GravityEngine.
        """
        from app.services.gravity_engine import gravity_engine
        from app.services.agent_service import agent_service
        
        try:
            # 1. Fetch flavored gravity data
            enriched_records = await gravity_engine.calculate_gravity(connection_id, table_name, column)
            
            # 2. Add 3D coordinates and Classification
            classification = await agent_service.get_record_classification(table_name)
            
            nodes = []
            for i, rec in enumerate(enriched_records):
                # 2. Use PCA-derived coordinates (Statistical Proof)
                # The GravityEngine has already done dimensionality reduction to 3D
                x = rec.get('pos_x', 0)
                y = rec.get('pos_y', 0)
                z = rec.get('pos_z', 0)
                
                # Jitter can be removed as PCA gives distinct positions
                # Unless points overlap perfectly (duplicates)
                
                nodes.append({
                    "id": f"rec_{i}",
                    "data": rec['data'],
                    "pos": [x, y, z],
                    "gravity": rec['gravity_score'],
                    "classification": classification,
                    "cluster": rec['cluster_group'], # Data-driven cluster ID
                    "val": rec['data'].get(column) # Store value for linking
                })
                
            # 3. Form flow links between records with matching values
            # This creates a "record chain" or "flow" for shared entities
            links = []
            value_map = {} # val -> list of node_ids
            for node in nodes:
                v = node['val']
                if v is not None:
                    if v not in value_map: value_map[v] = []
                    value_map[v].append(node.get('id', node.get('name', 'unknown')))
            
            for val, node_ids in value_map.items():
                # Link records in sequence if they share the same value
                if len(node_ids) > 1:
                    for j in range(len(node_ids) - 1):
                        links.append({
                            "source": node_ids[j], 
                            "target": node_ids[j+1], 
                            "type": "record_flow",
                            "value": str(val)
                        })
            
            return {
                "table": table_name,
                "classification": classification,
                "nodes": nodes,
                "links": links
            }
        except Exception as e:
            logger.info(f"Error in 3D clustering: {e}")
            import traceback
            traceback.print_exc()
            raise

# Global instance
drill_down_service = DrillDownService()

