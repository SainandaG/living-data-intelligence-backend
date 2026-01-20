"""
Hierarchical Flow Service - Analyzes and visualizes data flow with historical timestamps
"""
from typing import Dict, List, Any
from datetime import datetime, timedelta
from app.services.db_connector import db_connector
import random

class HierarchicalFlowService:
    """Service for hierarchical circle packing and historical flow analysis"""
    
    async def get_table_hierarchy(self, connection_id: str, table_name: str) -> Dict[str, Any]:
        """
        Get hierarchical structure of a table showing:
        - Columns as child circles
        - Related tables as sibling circles
        - Historical flow patterns
        """
        try:
            connection = db_connector.get_connection(connection_id)
            
            # Get table schema
            from app.services.schema_analyzer import schema_analyzer
            schema = await schema_analyzer.analyze_schema(connection_id)
            
            # Find the specific table
            table_info = next((t for t in schema.get('tables', []) if t['name'] == table_name), None)
            
            if not table_info:
                return {'error': 'Table not found'}
            
            # Build hierarchy
            hierarchy = {
                'name': table_name,
                'type': table_info.get('type', 'dimension'),
                'entity': table_info.get('entity', 'other'),
                'size': 100,
                'children': []
            }
            
            # Add columns as children
            for col in table_info.get('columns', []):
                child = {
                    'name': col.get('name', col),
                    'type': 'column',
                    'data_type': col.get('type', 'unknown') if isinstance(col, dict) else 'unknown',
                    'size': 20
                }
                hierarchy['children'].append(child)
            
            # Add related tables
            for rel in table_info.get('relationships', []):
                related = {
                    'name': rel['referenced_table'],
                    'type': 'related_table',
                    'relationship_type': rel.get('type', 'foreign_key'),
                    'size': 40
                }
                hierarchy['children'].append(related)
            
            return hierarchy
            
        except Exception as e:
            print(f"Error getting table hierarchy: {str(e)}")
            return {'error': str(e)}
    
    async def get_historical_flow(self, connection_id: str, table_name: str, hours: int = 24) -> List[Dict[str, Any]]:
        """
        Get historical data flow for a table with timestamps
        Simulates transaction flow over time
        """
        try:
            # In production, query actual transaction logs
            # For now, generate simulated historical data
            
            flow_data = []
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=hours)
            
            # Generate flow events every 5 minutes
            current_time = start_time
            while current_time <= end_time:
                # Simulate varying transaction volumes
                hour = current_time.hour
                
                # Peak hours: 9-11 AM, 2-4 PM
                if (9 <= hour <= 11) or (14 <= hour <= 16):
                    volume = random.randint(100, 500)
                else:
                    volume = random.randint(20, 100)
                
                flow_event = {
                    'timestamp': current_time.isoformat(),
                    'volume': volume,
                    'type': 'transaction',
                    'source': table_name,
                    'targets': self._get_related_tables(table_name)
                }
                
                flow_data.append(flow_event)
                current_time += timedelta(minutes=5)
            
            return flow_data
            
        except Exception as e:
            print(f"Error getting historical flow: {str(e)}")
            return []
    
    def _get_related_tables(self, table_name: str) -> List[str]:
        """Get commonly related tables based on entity type"""
        relations = {
            'transactions': ['accounts', 'customers', 'branches'],
            'accounts': ['customers', 'cards'],
            'customers': ['accounts', 'loans'],
            'fraud_alerts': ['transactions', 'accounts']
        }
        
        return relations.get(table_name, [])
    
    async def get_flow_animation_data(self, connection_id: str, table_name: str, timestamp: str) -> Dict[str, Any]:
        """
        Get specific flow data for a timestamp to animate
        """
        try:
            # Parse timestamp
            target_time = datetime.fromisoformat(timestamp)
            
            # Get flow data for that time window (±5 minutes)
            start_time = target_time - timedelta(minutes=5)
            end_time = target_time + timedelta(minutes=5)
            
            # Simulate flow particles
            particles = []
            related_tables = self._get_related_tables(table_name)
            
            for _ in range(random.randint(10, 50)):
                particle = {
                    'id': f"particle_{random.randint(1000, 9999)}",
                    'from': table_name,
                    'to': random.choice(related_tables) if related_tables else table_name,
                    'timestamp': target_time.isoformat(),
                    'type': random.choice(['normal', 'warning', 'fraud']),
                    'amount': round(random.uniform(10, 10000), 2)
                }
                particles.append(particle)
            
            return {
                'timestamp': timestamp,
                'table': table_name,
                'particles': particles,
                'volume': len(particles)
            }
            
        except Exception as e:
            print(f"Error getting flow animation data: {str(e)}")
            return {'error': str(e)}

# Global instance
hierarchical_flow_service = HierarchicalFlowService()
