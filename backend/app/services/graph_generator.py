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
    
    # Entity-specific color palette (BRIGHT, vibrant colors for dark background)
    ENTITY_COLORS = {
        'fact': '#fbbf24',       # Bright Gold/Amber
        'dimension': '#22d3ee',  # Bright Cyan
        'core': '#10b981',       # Bright Green
        'risk': '#ef4444',       # Bright Red
        'fraud': '#ef4444',
        'alert': '#f87171',
        'other': '#94a3b8'       # Light Gray
    }
    
    # Heuristic Mode - BRIGHT 3-color palette
    HEURISTIC_COLORS = [
        '#22d3ee',  # Bright Cyan
        '#10b981',  # Bright Green
        '#fbbf24',  # Bright Yellow/Gold
    ]
    
    # NetworkX Mode - BRIGHT distinct color palette
    NETWORKX_COLORS = [
        '#60a5fa',  # Bright Blue (lighter than before)
        '#a78bfa',  # Bright Purple (lighter)
        '#fb923c',  # Bright Orange (lighter)
        '#34d399',  # Bright Green (lighter)
    ]
    
    # Backward compatibility
    CLUSTER_COLORS = HEURISTIC_COLORS

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

    async def generate_graph(self, connection_id: str, cluster_assignments: Dict[str, str] = None, clustering_method: str = None) -> dict:
        """Generate 3D graph with Semantic Force Layout properties and cluster-aware positioning"""
        from app.services.schema_analyzer import schema_analyzer
        
        print(f"🎨 Generating graph for connection: {connection_id}")
        if cluster_assignments:
            print(f"📍 Using cluster-based positioning ({clustering_method} mode)")
        
        # 1. Get Base Schema
        schema_obj = await schema_analyzer.analyze_schema(connection_id)
        schema = schema_obj.model_dump() if hasattr(schema_obj, 'model_dump') else schema_obj
        
        tables = schema.get('tables', [])
        if not tables:
            return {'nodes': [], 'edges': []}
            
        nodes = []
        edges = []
        
        # 2. Add the Neural Core Hub (Dynamic size based on database)
        core_metrics = neural_core.get_core_metrics()
        num_tables = len(tables)
        # Scale core size: 70 for small DBs, 100 for large DBs (prominent central hub)
        core_size = min(100, max(70, 70 + (num_tables / 10)))
        
        nodes.append({
            'id': 'hub',
            'name': 'Neural Core',
            'group': 0, 'size': core_size, 'color': '#10b981',
            'entity': 'core',
            'x': 0, 'y': 0, 'z': 0,
            'target_x': 0, 'target_y': 0, 'target_z': 0, # Core is anchor
            'fixed': True,
            'row_count': core_metrics['signal_load'],
            'customMetrics': { 'Status': 'Active', 'Load': str(core_metrics['signal_load']) }
        })\

        # 3. Calculate cluster positions if clustering is active
        cluster_positions = {}
        if cluster_assignments:
            # Get unique clusters
            unique_clusters = list(set(cluster_assignments.values()))
            num_clusters = len(unique_clusters)
            
            # Arrange clusters in a circle around Neural Core
            for i, cluster_id in enumerate(unique_clusters):
                angle = (i / num_clusters) * 2 * math.pi
                radius = 400  # Distance from center
                cluster_positions[cluster_id] = {
                    'x': radius * math.cos(angle),
                    'y': radius * math.sin(angle),
                    'z': (i % 3 - 1) * 100  # Spread vertically across 3 levels
                }
            
            print(f"📍 Positioned {num_clusters} clusters in 3D space")

        # 4. Process Tables with CLUSTER-AWARE or STATISTICAL LOGIC
        table_map = {t['name']: t for t in tables}
        
        for i, table in enumerate(tables):
            name = table['name']
            
            # Get neural gravity for all tables (needed for node metadata)
            neural_gravity = neural_core.gravity_store.get(name, 1.0)
            
            # Determine positioning based on clustering
            if cluster_assignments and name in cluster_assignments:
                # CLUSTER-BASED POSITIONING
                cluster_id = cluster_assignments[name]
                cluster_center = cluster_positions.get(cluster_id, {'x': 0, 'y': 0, 'z': 0})
                
                # Count tables in this cluster for local positioning
                cluster_tables = [t for t in tables if cluster_assignments.get(t['name']) == cluster_id]
                local_index = cluster_tables.index(table)
                num_in_cluster = len(cluster_tables)
                
                # Arrange tables in a small circle within the cluster
                local_angle = (local_index / max(num_in_cluster, 1)) * 2 * math.pi
                local_radius = 80 + (num_in_cluster * 5)  # Radius grows with cluster size
                
                target_x = cluster_center['x'] + local_radius * math.cos(local_angle)
                target_y = cluster_center['y'] + local_radius * math.sin(local_angle)
                target_z = cluster_center['z'] + (random.random() - 0.5) * 30
            else:
                # FALLBACK: Statistical positioning (original logic)
                target_x, target_y, target_z = self._calculate_statistical_position(table, neural_gravity)
            
            # Start slightly randomized around target to allow physics to settle
            x = target_x + (random.random() - 0.5) * 30
            y = target_y + (random.random() - 0.5) * 30
            z = target_z + (random.random() - 0.5) * 30
            
            node = self._build_node_dict(table, x, y, z, 'semantic')
            # Inject statistical targets for frontend physics
            node['target_x'] = target_x
            node['target_y'] = target_y
            node['target_z'] = target_z
            node['neural_gravity'] = neural_gravity
            
            nodes.append(node)
            
            # Hub Connection (Nearly invisible - just keeps nodes from drifting)
            edges.append({
                'source': 'hub', 'target': name,
                'type': 'core_link',
                'link_strength': 0.05,
                'width': 0.5,  # Very thin line
                'opacity': 0.15,  # Almost invisible
                'traffic_intensity': 0.1
            })

        # 4. Generate Semantic Edges
        edge_set = set() # Avoid duplicates
        
        def add_edge(src, tgt, type_, strength, reason=""):
            if src == tgt: return
            key = tuple(sorted([src, tgt]))
            if key in edge_set: return
            
            # Visual distinction: FK = very thick/solid, others = thin/faded
            width = 3 if type_ == 'foreign_key' else 1
            opacity = 1.0 if type_ == 'foreign_key' else 0.4
            
            edges.append({
                'source': src, 'target': tgt,
                'type': type_,
                'link_strength': strength,
                'width': width,
                'opacity': opacity,
                'confidence': strength, # Critical: Frontend expects this for non-AI links too
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

    async def get_k_hop_lineage(self, connection_id: str, table_name: str, hops: int = 2) -> dict:
        """Trace data lineage up to K-hops using schema relationships"""
        from app.services.schema_analyzer import schema_analyzer
        schema_obj = await schema_analyzer.analyze_schema(connection_id)
        schema = schema_obj.model_dump() if hasattr(schema_obj, 'model_dump') else schema_obj
        tables = schema.get('tables', [])
        
        # 1. Build Adjacency List
        # Forward = referencing (downstream), Backward = referenced (upstream)
        adj = {}
        for t in tables:
            src = t['name']
            if src not in adj: adj[src] = []
            for fk in t.get('foreign_keys', []):
                tgt = fk.get('referenced_table')
                if tgt:
                    if tgt not in adj: adj[tgt] = []
                    # Bidirectional trace for general lineage
                    adj[src].append({'to': tgt, 'role': 'upstream'})
                    adj[tgt].append({'to': src, 'role': 'downstream'})

        # 2. BFS Traversal
        visited = {table_name}
        queue = [(table_name, 0)]
        lineage_nodes = []
        
        while queue:
            current, dist = queue.pop(0)
            if dist > 0:
                lineage_nodes.append(current)
            
            if dist < hops:
                for neighbor in adj.get(current, []):
                    if neighbor['to'] not in visited:
                        visited.add(neighbor['to'])
                        queue.append((neighbor['to'], dist + 1))
                        
        return {
            'origin': table_name,
            'lineage_nodes': lineage_nodes,
            'max_hops': hops
        }

    def _build_node_dict(self, table: dict, x, y, z, ring: str) -> dict:
        """Helper to build a unified node dictionary"""
        t_name = table['name']
        t_type = table.get('table_type', 'dimension')
        b_entity = table.get('business_entity', 'other')
        importance = table.get('importance_score', 10)
        row_count = table.get('row_count', 0)
        
        # Default color (will be overridden by cluster color if clustering is active)
        color = self.ENTITY_COLORS.get(t_type, self.ENTITY_COLORS['other'])
        if b_entity == 'fraud': color = self.ENTITY_COLORS['fraud']
        
        size = 20 + (importance * 2)
        
        return {
            'id': t_name,
            'name': t_name,
            'table_type': t_type,
            'entity': b_entity,
            'size': min(size, 70),
            'color': color,  # Default color, will be updated if cluster exists
            'row_count': row_count,
            'x': x, 'y': y, 'z': z,
            'ring': ring,
            'columns': table.get('columns', []),
            'foreign_keys': table.get('foreign_keys', []), # Critical for Neural Core patterns
            'customMetrics': {
                # Type and Entity removed to avoid UI duplication
                'Complexity': f"{len(table.get('columns', []))} cols"
            }
        }
    
    def get_cluster_color(self, cluster_name: str, method: str = 'heuristic') -> str:
        """Get consistent color for a cluster name based on method"""
        if method == 'networkx':
            palette = self.NETWORKX_COLORS
        else:
            palette = self.HEURISTIC_COLORS
        
        # Deterministic coloring based on Cluster ID
        # 1. Try to extract number from "nx_cluster_123"
        try:
            if "cluster_" in str(cluster_name):
                # Extract the last number
                idx = int(str(cluster_name).split('_')[-1])
                return palette[idx % len(palette)]
        except:
            pass
            
        # 2. Fallback to deterministic string hash (sum of chars) to be consistent across restarts
        # Python's hash() is randomized per process!
        char_sum = sum(ord(c) for c in str(cluster_name))
        return palette[char_sum % len(palette)]

    def _build_connections_map(self, tables: List[dict]) -> Dict[str, List[str]]:
        return {} # Deprecated

# Global instance
graph_generator = GraphGenerator()
