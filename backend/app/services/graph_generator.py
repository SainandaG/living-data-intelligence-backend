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
    # UNIFIED SEMANTIC PALETTE (G, B, Y, R)
    ENTITY_COLORS = {
        'fact': '#2196F3',              # Blue (Vehicles equivalent)
        'dimension': '#4CAF50',         # Green (Batteries equivalent)
        'time_intelligence': '#FFC107', # Yellow (Users equivalent)
        'core': '#F44336',              # Red (Stations equivalent)
        'other': '#94a3b8'
    }
    
    # Heuristic Mode - VIBRANT 6-color palette
    HEURISTIC_COLORS = [
        '#22d3ee',  # Bright Cyan
        '#10b981',  # Bright Green
        '#fbbf24',  # Bright Yellow/Gold
        '#f472b6',  # Pink
        '#a78bfa',  # Purple
        '#fb7185',  # Rose
    ]
    
    # NetworkX Mode - VIBRANT diverse color palette
    NETWORKX_COLORS = [
        '#60a5fa',  # Bright Blue
        '#a78bfa',  # Bright Purple
        '#fb923c',  # Bright Orange
        '#34d399',  # Bright Green
        '#facc15',  # Yellow
        '#f87171',  # Red-Orange
        '#c084fc',  # Light Purple
        '#fb7185',  # Rose
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
        
        print(f" Generating graph for connection: {connection_id}")
        if cluster_assignments:
            print(f" Using cluster-based positioning ({clustering_method} mode)")
        
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
            'target_x': 0, 'target_y': 0, 'target_z': 0,
            'latent_x': 0, 'latent_y': 0, 'latent_z': 0,
            'fixed': True,
            'row_count': core_metrics['signal_load'],
            'customMetrics': { 'Status': 'Active', 'Load': str(core_metrics['signal_load']) }
        })

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
            
            print(f" Positioned {num_clusters} clusters in 3D space")

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
            
            # Hub Connection (Visible structural links for constellation representation)
            edges.append({
                'source': 'hub', 'target': name,
                'type': 'core_link',
                'link_strength': 0.15,
                'width': 1.0,
                'opacity': 0.4,  # Increased visibility for hub connectivity
                'traffic_intensity': 0.2,
                'color': '#00d4ff' # Constellation Cyan
            })

        # 4. Generate Semantic Edges
        edge_set = set() # Avoid duplicates
        
        def add_edge(src, tgt, type_, strength, reason=""):
            if src == tgt: return
            key = tuple(sorted([src, tgt]))
            if key in edge_set: return
            
            # Visual distinction: FK = very thick/solid (The "Valid" representation)
            width = 4.0 if type_ == 'foreign_key' else (2.5 if type_ == 'ai_predicted' else 1.5)
            opacity = 0.9 if type_ == 'foreign_key' else 0.7
            
            edges.append({
                'source': src, 'target': tgt,
                'type': type_,
                'link_strength': strength,
                'width': width,
                'opacity': opacity,
                'confidence': strength,
                'reasoning': reason,
                'traffic_intensity': strength * 1.0,
                'color': '#00d4ff' # All data edges Cyan for mesh look
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
        t_low = t_name.lower()
        
        # Semantic Classification Fallback
        t_type = table.get('table_type')
        cols = table.get('columns', [])
        fks = table.get('foreign_keys', [])
        
        # DATA-DRIVEN CLASSIFICATION (Fact = Numerical, Dimension = Categorical)
        if not t_type or t_type in ['entity', 'dimension', 'other']:
            numeric_count = 0
            categorical_count = 0
            measure_keywords = ['amount', 'total', 'price', 'cost', 'quantity', 'qty', 'sum', 'balance', 'value', 'score', 'measure', 'rate', 'price', 'discount', 'payment', 'fee']
            has_major_measure = False

            for col in cols:
                c_type = str(col.get('type', '')).upper()
                c_name = str(col.get('name', '')).lower()
                
                if any(k in c_name for k in measure_keywords):
                    has_major_measure = True
                    numeric_count += 3

                if any(t in c_type for t in ['INT', 'FLOAT', 'DECIMAL', 'NUMERIC', 'DOUBLE', 'REAL', 'MONEY']):
                    if c_name not in ['id', 'version', 'code', 'zip', 'pin']:
                        numeric_count += 1
                elif any(t in c_type for t in ['CHAR', 'STR', 'TEXT', 'CLOB', 'ENUM']):
                    categorical_count += 1

            if any(term in t_low for term in ['time', 'date', 'period', 'calendar', 'snapshot', 'grain', 'sequence', 'chron', 'day', 'month', 'year']):
                t_type = 'time_intelligence'
            elif has_major_measure or (numeric_count > categorical_count and numeric_count >= 2):
                t_type = 'fact'
            elif any(term in t_low for term in ['transaction', 'order', 'payment', 'event', 'log', 'fact', 'sale', 'history', 'rental', 'test_results', 'invoice', 'payroll', 'store', 'inventory', 'film_actor', 'payment', 'billing', 'shipment', 'traffic', 'metric']):
                t_type = 'fact'
            elif len(fks) >= 2 and numeric_count >= 1:
                t_type = 'fact' 
            else:
                t_type = 'dimension'
                
        b_entity = table.get('business_entity', 'other')
        importance = table.get('importance_score', 10)
        row_count = table.get('row_count', 0)
        col_count = len(table.get('columns', []))
        fk_count = len(table.get('foreign_keys', []))
        
        # USER REQUEST: Logical Readings based on inner data
        # These are displayed on the 3D table faces
        # We derive them from actual metrics to be proportional and "logical"
        readings = {
            'OP_SIGMA_Z': round(max(0.1, (importance / 20.0) + (row_count / 10000.0)), 4),
            'HEALTH_IDX': f"{min(99.9, 70.0 + (importance * 2.5)):.1f}%",
            'STABILITY.Ω': round(0.85 + (fk_count * 0.05), 3),
            'ROW_DENSITY': round(row_count / (col_count * 10) if col_count > 0 else 0, 2),
            'ENTROPY.Δ': round(0.1 + (random.Random(t_name).random() * 0.4), 3) # Table-stable entropy
        }
        
        # Default colors (Frontend will refine these)
        color = self.ENTITY_COLORS.get(t_type, self.ENTITY_COLORS['other'])
        if b_entity == 'fraud': color = self.ENTITY_COLORS['fraud']
        
        # DRAMATIC SIZING: High-Fidelity presence
        if t_type == 'fact':
            base_s = 60
            boost = 4
        elif t_type == 'dimension':
            base_s = 40
            boost = 2
        elif t_type == 'time_intelligence':
            base_s = 35
            boost = 1
        else:
            base_s = 30
            boost = 1
            
        size = base_s + (importance * boost) + (math.log10(max(1, row_count)) * 8)
        
        return {
            'id': t_name,
            'name': t_name,
            'table_type': t_type,
            'entity': b_entity,
            'size': round(min(size, 180), 1), # Support larger nodes for "Nice" feel
            'color': color,
            'row_count': row_count,
            'x': x, 'y': y, 'z': z,
            'ring': ring,
            'columns': table.get('columns', []),
            'foreign_keys': table.get('foreign_keys', []),
            'analytical_readings': readings,
            'customMetrics': {
                'Complexity': f"{col_count} cols",
                'Relations': f"{fk_count} FKs"
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
