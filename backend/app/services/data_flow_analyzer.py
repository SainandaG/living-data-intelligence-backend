"""
Data Flow Analyzer - Uses Agentic AI to analyze record-level data flows
Discovers FK/PK relationships + inferred connections based on patterns
"""
import asyncio
from typing import Dict, List, Any, Optional
from app.services.agent_service import agent_service
from app.services.db_connector import db_connector

class DataFlowAnalyzer:
    """Analyze data flow patterns using Agentic AI"""
    
    def __init__(self):
        self.flow_cache = {}  # Cache analyzed flows
    
    async def analyze_table_flow(self, connection_id: str, table_name: str) -> Dict[str, Any]:
        """
        Analyze data flow for a specific table using AI
        Returns flow graph with nodes, edges, and relationship metadata
        """
        cache_key = f"{connection_id}:{table_name}"
        if cache_key in self.flow_cache:
            return self.flow_cache[cache_key]
        
        print(f"🔍 Analyzing data flow for table: {table_name}")
        
        # Get schema for context
        from app.services.schema_analyzer import schema_analyzer
        schema = await schema_analyzer.analyze_schema(connection_id)
        schema_dict = schema.dict() if hasattr(schema, 'dict') else schema.model_dump()
        
        # Find the target table
        target_table = None
        for table in schema_dict.get('tables', []):
            if table['name'] == table_name:
                target_table = table
                break
        
        if not target_table:
            return {'nodes': [], 'edges': [], 'relationships': []}
        
        # Build flow graph
        flow_graph = {
            'nodes': [],
            'edges': [],
            'relationships': []
        }
        
        # 1. Add the main table as central node
        flow_graph['nodes'].append({
            'id': table_name,
            'name': table_name,
            'type': 'primary',
            'row_count': target_table.get('row_count', 0),
            'columns': target_table.get('columns', [])
        })
        
        # 2. Discover explicit FK relationships
        explicit_rels = self._discover_fk_relationships(target_table, schema_dict)
        flow_graph['relationships'].extend(explicit_rels)
        
        # 3. Use AI to infer additional relationships
        inferred_rels = await self._infer_relationships(target_table, schema_dict)
        flow_graph['relationships'].extend(inferred_rels)
        
        # 4. Build nodes and edges from relationships
        for rel in flow_graph['relationships']:
            # Add related table as node if not exists
            related_table_name = rel['target'] if rel['source'] == table_name else rel['source']
            if not any(n['id'] == related_table_name for n in flow_graph['nodes']):
                related_table = next((t for t in schema_dict['tables'] if t['name'] == related_table_name), None)
                if related_table:
                    flow_graph['nodes'].append({
                        'id': related_table_name,
                        'name': related_table_name,
                        'type': 'related',
                        'row_count': related_table.get('row_count', 0)
                    })
            
            # Add edge
            flow_graph['edges'].append({
                'source': rel['source'],
                'target': rel['target'],
                'type': rel['type'],
                'column': rel.get('column'),
                'confidence': rel.get('confidence', 1.0),
                'reasoning': rel.get('reasoning', '')
            })
        
        # Cache the result
        self.flow_cache[cache_key] = flow_graph
        print(f"✅ Flow analysis complete: {len(flow_graph['nodes'])} nodes, {len(flow_graph['edges'])} edges")
        
        return flow_graph
    
    def _discover_fk_relationships(self, table: Dict, schema: Dict) -> List[Dict]:
        """Discover explicit FK relationships"""
        relationships = []
        table_name = table['name']
        
        # Outgoing FKs (this table references others)
        for fk in table.get('foreign_keys', []):
            relationships.append({
                'source': table_name,
                'target': fk['referenced_table'],
                'type': 'fk',
                'column': fk['column'],
                'confidence': 1.0,
                'reasoning': f"Foreign key: {fk['column']} → {fk['referenced_table']}"
            })
        
        # Incoming FKs (other tables reference this one)
        for other_table in schema.get('tables', []):
            if other_table['name'] == table_name:
                continue
            for fk in other_table.get('foreign_keys', []):
                if fk['referenced_table'] == table_name:
                    relationships.append({
                        'source': other_table['name'],
                        'target': table_name,
                        'type': 'fk',
                        'column': fk['column'],
                        'confidence': 1.0,
                        'reasoning': f"Referenced by {other_table['name']}.{fk['column']}"
                    })
        
        return relationships
    
    async def _infer_relationships(self, table: Dict, schema: Dict) -> List[Dict]:
        """Use AI to infer non-FK relationships"""
        relationships = []
        table_name = table['name']
        
        # Use Agentic AI to discover semantic relationships
        try:
            prompt = f"""
            Analyze the following database table and suggest potential relationships with other tables
            based on column names, business logic, and semantic patterns.
            
            Target Table: {table_name}
            Columns: {[c['name'] for c in table.get('columns', [])]}
            
            Other Tables: {[t['name'] for t in schema.get('tables', []) if t['name'] != table_name]}
            
            Return relationships that are NOT already defined as foreign keys but make semantic sense.
            For example: "customers" might relate to "orders" even without an FK if they share similar column patterns.
            """
            
            # Use agent service for AI analysis
            suggestions = await agent_service.analyze_relationships(table_name, schema)
            
            # Parse AI suggestions into relationships
            for suggestion in suggestions:
                if suggestion.get('confidence', 0) > 0.5:  # Only high-confidence inferences
                    relationships.append({
                        'source': table_name,
                        'target': suggestion['target_table'],
                        'type': 'inferred',
                        'column': suggestion.get('column'),
                        'confidence': suggestion['confidence'],
                        'reasoning': suggestion.get('reasoning', 'AI-inferred semantic relationship')
                    })
        
        except Exception as e:
            print(f"⚠️ AI relationship inference failed: {e}")
        
        return relationships
    
    async def get_flow_path(self, connection_id: str, from_table: str, to_table: str) -> List[str]:
        """
        Get the data flow path between two tables
        Returns list of table names representing the path
        """
        # Build a graph of all relationships
        from app.services.schema_analyzer import schema_analyzer
        schema = await schema_analyzer.analyze_schema(connection_id)
        schema_dict = schema.dict() if hasattr(schema, 'dict') else schema.model_dump()
        
        # Simple BFS to find shortest path
        graph = {}
        for table in schema_dict.get('tables', []):
            table_name = table['name']
            graph[table_name] = []
            for fk in table.get('foreign_keys', []):
                graph[table_name].append(fk['referenced_table'])
        
        # BFS
        queue = [(from_table, [from_table])]
        visited = {from_table}
        
        while queue:
            current, path = queue.pop(0)
            if current == to_table:
                return path
            
            for neighbor in graph.get(current, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, path + [neighbor]))
        
        return []  # No path found

# Global instance
data_flow_analyzer = DataFlowAnalyzer()
