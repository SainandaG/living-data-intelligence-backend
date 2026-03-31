"""
Ontology Service

Classifies tables into semantic ontology types (fact, dimension, reference) based on naming patterns and structure.
"""
from typing import Dict, Any
from app.services.neural_core import neural_core
from app.services.schema_analyzer import schema_analyzer

class OntologyService:
    """
    Formal Semantic Layer (Ontology) Service.
    Maps technical database schemas to Entity-Object-Link (EOL) structures.
    """

    async def get_active_ontology(self, connection_id: str) -> Dict[str, Any]:
        """
        Synthesize a complete ontology for the given connection.
        Combines deterministic schema data with AI-enhanced semantic mapping.
        """
        # 1. Get base schema
        schema_obj = await schema_analyzer.analyze_schema(connection_id)
        schema = schema_obj.model_dump() if hasattr(schema_obj, 'model_dump') else schema_obj
        
        # 2. Extract Ontology Objects (Tables)
        objects = []
        for table in schema.get('tables', []):
            name = table.get('name')
            # Check for domain specialization (WEZU Energy)
            static_mapping = neural_core.WEZU_ENERGY_ONTOLOGY.get(name)
            
            obj = {
                'id': name,
                'type': static_mapping.get('type') if static_mapping else table.get('table_type', 'dimension'),
                'entity': static_mapping.get('type') if static_mapping else table.get('business_entity', 'other'),
                'displayName': name.replace('_', ' ').title(),
                'provenance': static_mapping.get('justification') if static_mapping else table.get('decision_provenance'),
                'properties': table.get('property_mapping', {}),
                'technical': {
                    'rowCount': table.get('row_count', 0),
                    'columns': [c.get('name') for c in table.get('columns', [])]
                }
            }
            objects.append(obj)
            
        # 3. Extract Ontology Links (Relationships)
        links = []
        for rel in schema.get('relationships', []):
            links.append({
                'source': rel.get('from_table'),
                'target': rel.get('to_table'),
                'predicate': 'RELATES_TO', # AI could enhance this later to 'OWNED_BY', 'PART_OF', etc.
                'technical': {
                    'from': rel.get('from_column'),
                    'to': rel.get('to_column')
                }
            })
            
        return {
            'connectionId': connection_id,
            'objects': objects,
            'links': links,
            'summary': {
                'objectCount': len(objects),
                'linkCount': len(links),
                'status': 'Synchronized'
            }
        }

# Global instance
ontology_service = OntologyService()
