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
        # Deep Center = 5.0 (Nexus), Peripheral = 1.0
        pos_z = (neural_gravity - 3.0) * 150 # Center around 3.0
        pos_z = max(-400, min(800, pos_z))

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
        core_metrics = await neural_core.get_core_metrics(connection_id)
        num_tables = len(tables)
        # Scale core size: 70 for small DBs, 100 for large DBs (prominent central hub)
        core_size = min(100, max(70, 70 + (num_tables / 10)))
        
        # Pull real gravity maps
        gravity_store = neural_core.gravity_stores.get(connection_id, {})
        
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
            neural_gravity = gravity_store.get(name, 1.0)
            
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
                target_z = cluster_center['z'] # Removed random spread
            else:
                # FALLBACK: Statistical positioning (original logic)
                target_x, target_y, target_z = self._calculate_statistical_position(table, neural_gravity)
            
            # Positions are now 100% deterministic based on statistical/cluster logic
            x = target_x
            y = target_y
            z = target_z
            
            node = self._build_node_dict(table, x, y, z, 'semantic')
            # Inject statistical targets for frontend physics
            node['target_x'] = target_x
            node['target_y'] = target_y
            node['target_z'] = target_z
            # Apply authenticated values to the node (assuming auth_metrics, in_deg, out_deg are defined elsewhere or will be)
            # NOTE: The following lines are added as per instruction, but `auth_metrics`, `in_deg`, `out_deg` are not defined in this scope.
            # This might lead to a NameError if these variables are not introduced before this point.
            # For the purpose of faithfully applying the change as instructed, they are included.
            # node['vitality'] = auth_metrics['vitality']
            # node['gravity_pull'] = auth_metrics['pull_factor']
            # node['importance_score'] = auth_metrics['gravity'] # Use authenticated gravity for GNN-level importance
            node['neural_gravity'] = neural_gravity # Keeping original for now to avoid NameError, as auth_metrics is not defined.
                                                    # If auth_metrics were defined, this would be: node['neural_gravity'] = auth_metrics['gravity']
            # node['entropy'] = auth_metrics['entropy']
            
            # Explicitly inject degrees for frontend inspection
            # node['in_degree'] = in_deg
            # node['out_degree'] = out_deg
            
            # FIX: Apply Cluster Color if clustering is active
            if cluster_assignments and name in cluster_assignments:
                cluster_id = cluster_assignments[name]
                # Use the helper to get consistent color for this cluster ID
                node['color'] = self.get_cluster_color(cluster_id, clustering_method or 'heuristic')
            
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
        
        def add_edge(src, tgt, type_, strength, reason="", column=None):
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
                'column': column, # [NEW] Inject technical metadata for Column Particles
                'traffic_intensity': strength * 0.8 
            })
            edge_set.add(key)

        # A. Foreign Keys (Strongest)
        for table in tables:
            t_name = table['name']
            for fk in table.get('foreign_keys', []):
                ref = fk.get('referenced_table')
                col = fk.get('column')
                if ref and ref in table_map:
                    add_edge(t_name, ref, 'foreign_key', 0.95, f"FK: {col}", column=col)

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
        # C. AI Predictions (Parallelized)
        valid_targets = [n['id'] for n in nodes if n['id'] != 'hub']
        
        # Create tasks for all tables
        import asyncio
        prediction_tasks = []
        for table in tables:
            t_name = table['name']
            prediction_tasks.append(neural_core.predict_links(connection_id, t_name, valid_targets))
            
        # Execute all in parallel
        # This reduces 120 sequential awaits to 1 concurrent block
        all_predictions = await asyncio.gather(*prediction_tasks, return_exceptions=True)
        
        for i, predictions in enumerate(all_predictions):
            if isinstance(predictions, list):
                t_name = tables[i]['name']
                for pred in predictions:
                    if pred.get('confidence', 0) > 0.6: 
                        add_edge(t_name, pred['target_id'], 'ai_predicted', pred['confidence'], pred.get('reasoning'))
            else:
                 # Handle exception
                 pass

        # --- PASS 2: Unified Metrics Synchronization ---
        # Now that we have all edges (Topology), we can calculate the EXACT scores 
        # that match the Analysis Engine (which also sees these edges).
        
        # 1. Build Local Topology Map (Adjacency Lists)
        local_in_degree = {}
        local_out_degree = {}
        upstream_map = {}
        downstream_map = {}
        
        for e in edges:
            s_id = e['source']
            t_id = e['target']
            local_out_degree[s_id] = local_out_degree.get(s_id, 0) + 1
            local_in_degree[t_id] = local_in_degree.get(t_id, 0) + 1
            
            # Adjacency for visual landscaping (Step 1 enrichment)
            # [STRICT ALIGNMENT] Ignore hub/core for data dependency metrics
            if s_id in ['hub', 'DATABASE_CORE'] or t_id in ['hub', 'DATABASE_CORE']:
                continue

            if s_id not in downstream_map: downstream_map[s_id] = []
            downstream_map[s_id].append(t_id)
            
            if t_id not in upstream_map: upstream_map[t_id] = []
            upstream_map[t_id].append(s_id)
            
        # 1. Calculate Transitive Dependencies (for Semantic Mountains)
        dependency_depths = {}
        affected_counts = {}
        total_nodes_count = len(nodes)
        
        def get_transitive_downstream(node_id, visited=None):
            if visited is None: visited = set()
            count = 0
            for child in downstream_map.get(node_id, []):
                if child not in visited:
                    visited.add(child)
                    count += 1 + get_transitive_downstream(child, visited)
            return count

        def get_max_upstream_depth(node_id, visited=None):
            if visited is None: visited = set()
            if node_id in visited: return 0
            visited.add(node_id)
            upstreams = upstream_map.get(node_id, [])
            if not upstreams: return 0
            return 1 + max(get_max_upstream_depth(u, visited) for u in upstreams)

        for n in nodes:
            name = n['name']
            affected_counts[name] = get_transitive_downstream(name)
            dependency_depths[name] = get_max_upstream_depth(name)

        # 2. Re-score Every Node
        from app.services.graph_intelligence import graph_intelligence
        
        # Calculate system total for entropy context
        total_system_connections = len(edges) * 2
        
        for node in nodes:
            n_name = node['name']
            
            # Get authenticated inputs
            row_count = node.get('row_count', 0)
            in_d = local_in_degree.get(n_name, 0)
            out_d = local_out_degree.get(n_name, 0)
            
            # Call the Single Source of Truth
            auth_metrics = graph_intelligence.get_authenticated_metrics(
                n_name,
                row_count,
                in_d,
                out_d,
                total_system_connections=total_system_connections
            )
            
            # Update Node with Validated Logic
            # This ensures the "Graph View" shows the exact same numbers as the "Drilldown"
            v_score = auth_metrics['vitality']
            node['vitality'] = v_score
            node['neural_gravity'] = auth_metrics['gravity'] 
            node['importance_score'] = auth_metrics['gravity'] 
            node['gravity_pull'] = auth_metrics['pull_factor']
            node['entropy'] = auth_metrics['entropy']
            
            # [NEW] Explicit Anomaly Signal
            # 1. Vitality < 25 (Legitimate sickness)
            # 2. Presence of critical errors/fraud in business context
            node['is_anomalous'] = (v_score < 25) or (node.get('entity') == 'fraud') or ("err" in n_name.lower())
            
            # Inject dependency info (for Semantic Mountains)
            node['has_upstream_deps'] = n_name in upstream_map
            node['upstream_node_ids'] = upstream_map.get(n_name, [])
            node['downstream_node_ids'] = downstream_map.get(n_name, [])
            
            # Inject degrees for debug visibility
            node['in_degree'] = in_d
            node['out_degree'] = out_d
            
            # [STRICT ALIGNMENT] Extended Metadata
            n_lower = n_name.lower()
            fact_keywords = ["fact", "trans", "sale", "payment", "order", "entry", "reading", "metric", "event", "data", "history", "measure"]
            node['is_fact_table'] = (node.get('table_type') == 'fact') or \
                                    any(k in n_lower for k in fact_keywords)
            
            # [REFINEMENT] Treat independent source tables as "Facts" for visualization if they are roots
            node['is_source'] = not node['has_upstream_deps']
            
            node['is_dimension_table'] = (node.get('table_type') == 'dimension') or \
                                         any(k in n_lower for k in ["dim", "user", "cust", "prod", "item", "sku"])
            node['dependency_depth'] = dependency_depths.get(n_name, 0)
            node['affected_downstream_count'] = affected_counts.get(n_name, 0)
            # independency_score: % of nodes that depend on this node
            node['independency_score'] = (node['affected_downstream_count'] / total_nodes_count) if total_nodes_count > 0 else 0
            node['anomaly_severity'] = max(0, 100 - v_score)
            node['health_score'] = v_score
            
            # Update visual size based on NEW vitality/gravity if needed
            # (Optional: we can keep the size logic from Pass 1 or update it here)

        return {
            'nodes': nodes, 
            'edges': edges
        }

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

    def _build_node_dict(self, table: dict, x: float, y: float, z: float, method: str) -> dict:
        """Helper to build standardized node dictionary"""
        t_name = table.get('name', 'unknown')
        t_type = table.get('table_type', 'dimension')
        b_entity = table.get('business_entity', 'other')
        row_count = table.get('row_count', 0)
        
        # Calculate size based on row count (logarithmic)
        size = 20 + (math.log10(max(row_count, 1)) * 5)
        
        # Default color
        color = self.ENTITY_COLORS.get(t_type, self.ENTITY_COLORS.get('other', '#94a3b8'))
        if b_entity == 'fraud': color = self.ENTITY_COLORS.get('fraud', '#ef4444')
        
        return {
            'id': t_name,
            'name': t_name,
            'table_type': t_type,
            'entity': b_entity,
            'size': min(size, 80), # Limit max size
            'color': color,
            'row_count': row_count,
            'record_count': row_count, # Redundancy factor
            'decision_provenance': table.get('decision_provenance'),
            'property_mapping': table.get('property_mapping'),
            'x': x, 'y': y, 'z': z,
            'columns': table.get('columns', []),
            'foreign_keys': table.get('foreign_keys', []),
            'customMetrics': {
                'Complexity': f"{len(table.get('columns', []))} cols",
                'Provenance': 'AI Verified' if table.get('decision_provenance') else 'Heuristic'
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
