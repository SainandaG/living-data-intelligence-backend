"""
Graph Generator - Creates 3D graph structure from database schema
Enhanced with AI (Neural Core & RL) for intelligent layout and link prediction.
"""
import math
import random
from typing import Dict, List
from app.services.neural_core import neural_core
from app.services.rl_optimizer import rl_optimizer

class GraphGenerator:
    """Generate 3D graph from database schema with advanced visualization"""
    
    # Entity-specific color palette (vibrant, distinct colors)
    ENTITY_COLORS = {
        'fact': '#fbbf24',       # Gold/Amber
        'dimension': '#22d3ee',  # Cyan
        'core': '#22d3ee',       # Cyan for Neural Core
        'risk': '#ef4444',       # Red
        'fraud': '#ef4444',
        'alert': '#f87171',
        'other': '#64748b'       # Gray
    }

    def _calculate_statistical_position(self, table: dict, neural_gravity: float) -> tuple:
        """
        Calculate deterministic 3D position based on statistical vectors.
        X = Data Volume (Row Count)
        Y = Structural Complexity (Columns + FKs)
        Z = Neural Importance (AI Gravity)
        """
        # 1. X-Axis: Data Volume (Logarithmic)
        row_count = table.get('row_count', 0)
        # Log scale: 0 -> 0, 1M -> 6. Normalize to -600 to +600
        log_rows = math.log10(max(row_count, 1))
        # Center around 1000 rows (log=3). <1000 = Left, >1000 = Right
        pos_x = (log_rows - 3.0) * 200 
        pos_x = max(-800, min(800, pos_x)) # Clamp

        # 2. Y-Axis: Complexity
        col_count = len(table.get('columns', []))
        fk_count = len(table.get('foreign_keys', []))
        complexity = col_count + (fk_count * 2)
        # Center around avg complexity of 10. <10 = Down, >10 = Up
        pos_y = (complexity - 10) * 40
        pos_y = max(-500, min(500, pos_y))

        # 3. Z-Axis: Neural Gravity (AI Score)
        # Gravity ranges 1.0 to 5.0. 
        # Standard = 1.0 (Back), High Value = 5.0 (Front)
        pos_z = (neural_gravity - 1.0) * 150
        pos_z = max(-200, min(600, pos_z))

        return (pos_x, pos_y, pos_z)

    async def generate_graph(self, connection_id: str) -> dict:
        """Generate 3D graph with Semantic Force Layout properties"""
        from app.services.schema_analyzer import schema_analyzer
        
        print(f"🎨 Generating graph for connection: {connection_id}")
        
        # 1. Get Base Schema
        schema_obj = await schema_analyzer.analyze_schema(connection_id)
        schema = schema_obj.model_dump() if hasattr(schema_obj, 'model_dump') else schema_obj
        
        tables = schema.get('tables', [])
        if not tables:
            return {'nodes': [], 'edges': []}
            
        nodes = []
        edges = []
        
        # 2. Add the Neural Core Hub
        core_metrics = neural_core.get_core_metrics()
        nodes.append({
            'id': 'hub',
            'name': 'Neural Core',
            'group': 0, 'size': 80, 'color': '#22d3ee',
            'entity': 'core',
            'x': 0, 'y': 0, 'z': 0,
            'target_x': 0, 'target_y': 0, 'target_z': 0, # Core is anchor
            'fixed': True,
            'row_count': core_metrics['signal_load'],
            'customMetrics': { 'Status': 'Active', 'Load': str(core_metrics['signal_load']) }
        })

        # 3. Process Tables with STATISTICAL LOGIC
        table_map = {t['name']: t for t in tables}
        
        for i, table in enumerate(tables):
            name = table['name']
            
            # AI-Driven Positioning
            neural_gravity = neural_core.gravity_store.get(name, 1.0)
            target_x, target_y, target_z = self._calculate_statistical_position(table, neural_gravity)
            
            # Start slightly randomized around target to allow physics to settle
            x = target_x + (random.random() - 0.5) * 50
            y = target_y + (random.random() - 0.5) * 50
            z = target_z + (random.random() - 0.5) * 50
            
            node = self._build_node_dict(table, x, y, z, 'semantic')
            # Inject statistical targets for frontend physics
            node['target_x'] = target_x
            node['target_y'] = target_y
            node['target_z'] = target_z
            node['neural_gravity'] = neural_gravity
            
            nodes.append(node)
            
            # Hub Connection (Weak pull just to keep in universe)
            edges.append({
                'source': 'hub', 'target': name,
                'type': 'core_link',
                'link_strength': 0.05, 
                'traffic_intensity': 0.1
            })

        # 4. Generate Semantic Edges
        edge_set = set() # Avoid duplicates
        
        def add_edge(src, tgt, type_, strength, reason=""):
            if src == tgt: return
            key = tuple(sorted([src, tgt]))
            if key in edge_set: return
            edges.append({
                'source': src, 'target': tgt,
                'type': type_,
                'link_strength': strength,
                'reasoning': reason,
                'traffic_intensity': strength * 0.8 
            })
            edge_set.add(key)

        # A. Foreign Keys (Strongest)
        for table in tables:
            t_name = table['name']
            for fk in table.get('foreign_keys', []):
                ref = fk.get('referenced_table')
                if ref and ref in table_map:
                    add_edge(t_name, ref, 'foreign_key', 0.95, f"FK: {fk.get('column')}")

        # B. Matching Columns (Medium)
        for i in range(len(tables)):
            for j in range(i + 1, len(tables)):
                t1 = tables[i]
                t2 = tables[j]
                
                cols1 = {c['name'] for c in t1.get('columns', []) if c['name'] not in ['id', 'created_at', 'updated_at']}
                cols2 = {c['name'] for c in t2.get('columns', []) if c['name'] not in ['id', 'created_at', 'updated_at']}
                
                matches = cols1.intersection(cols2)
                if matches:
                    strength = min(0.3 + (len(matches) * 0.1), 0.7)
                    add_edge(t1['name'], t2['name'], 'matching_col', strength, f"Shared: {list(matches)[:3]}")

        # C. AI Predictions (Variable)
        valid_targets = [n['id'] for n in nodes if n['id'] != 'hub']
        for table in tables:
            t_name = table['name']
            predictions = await neural_core.predict_links(t_name, valid_targets)
            for pred in predictions:
                if pred['confidence'] > 0.6: 
                    add_edge(t_name, pred['target_id'], 'ai_predicted', pred['confidence'], pred.get('reasoning'))

        return {'nodes': nodes, 'edges': edges}

    def _build_node_dict(self, table: dict, x, y, z, ring: str) -> dict:
        """Helper to build a unified node dictionary"""
        t_name = table['name']
        t_type = table.get('table_type', 'dimension')
        b_entity = table.get('business_entity', 'other')
        importance = table.get('importance_score', 10)
        row_count = table.get('row_count', 0)
        
        color = self.ENTITY_COLORS.get(t_type, self.ENTITY_COLORS['other'])
        if b_entity == 'fraud': color = self.ENTITY_COLORS['fraud']
        
        size = 20 + (importance * 2)
        
        return {
            'id': t_name,
            'name': t_name,
            'table_type': t_type,
            'entity': b_entity,
            'size': min(size, 70),
            'color': color,
            'row_count': row_count,
            'x': x, 'y': y, 'z': z,
            'ring': ring,
            'columns': table.get('columns', []),
            'customMetrics': {
                'Type': t_type.upper(),
                'Entity': b_entity.capitalize()
            }
        }

    def _build_connections_map(self, tables: List[dict]) -> Dict[str, List[str]]:
        return {} # Deprecated

# Global instance
graph_generator = GraphGenerator()
# Global instance
graph_generator = GraphGenerator()
