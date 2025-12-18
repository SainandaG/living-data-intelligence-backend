from app.services.schema_analyzer import schema_analyzer
from app.models.schemas import Graph, GraphNode, GraphEdge, Schema
import math
import random

class GraphGenerator:
    """Generate 3D graph structure from database schema"""
    
    async def generate_graph(self, connection_id: str) -> Graph:
        """Generate graph from schema"""
        print(f"🎨 Generating graph for connection: {connection_id}")
        
        # Get schema
        schema = await schema_analyzer.analyze_schema(connection_id)
        
        # Create nodes
        nodes = []
        for table in schema.tables:
            node = self._create_node(table)
            nodes.append(node)
        
        # Position nodes in 3D space using force-directed layout
        nodes = self._position_nodes(nodes)
        
        # Create edges from relationships
        edges = []
        for rel in schema.relationships:
            edge = GraphEdge(
                source=rel.from_table,
                target=rel.to_table,
                type='foreign_key'
            )
            edges.append(edge)
        
        graph = Graph(nodes=nodes, edges=edges)
        
        print(f"✅ Graph generated: {len(nodes)} nodes, {len(edges)} edges")
        return graph
    
    def _create_node(self, table) -> GraphNode:
        """Create a graph node from a table"""
        # Determine color based on entity type
        color_map = {
            'transaction': '#00d4ff',  # Cyan
            'customer': '#00ff88',     # Green
            'account': '#00d4ff',      # Teal
            'fraud': '#ff4757',        # Red
            'branch': '#ffd60a',       # Yellow
            'employee': '#9d4edd',     # Purple
            'loan': '#06ffa5',         # Mint
            'card': '#ff6b9d',         # Pink
            'other': '#707888'         # Gray
        }
        
        color = color_map.get(table.business_entity, '#707888')
        
        # Size based on importance
        size = 10 + (table.importance_score * 5)
        
        return GraphNode(
            id=table.name,
            name=table.name,
            type=table.table_type or 'unknown',
            entity=table.business_entity or 'other',
            size=size,
            color=color,
            row_count=table.row_count,
            metrics=table.numeric_columns
        )
    
    def _position_nodes(self, nodes: list) -> list:
        """Position nodes in 3D space using force-directed algorithm"""
        # Simple circular layout for now
        # In production, use a proper force-directed algorithm
        
        num_nodes = len(nodes)
        radius = 200
        
        for i, node in enumerate(nodes):
            angle = (2 * math.pi * i) / num_nodes
            
            # Arrange in a sphere
            phi = math.acos(1 - 2 * (i + 0.5) / num_nodes)
            theta = math.pi * (1 + 5**0.5) * i
            
            node.x = radius * math.sin(phi) * math.cos(theta)
            node.y = radius * math.sin(phi) * math.sin(theta)
            node.z = radius * math.cos(phi)
        
        return nodes

# Global instance
graph_generator = GraphGenerator()
