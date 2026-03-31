"""
Tests for graph_generator.py — core graph building.

Coverage targets:
  - generate_graph: nodes include hub, tables become nodes, edges created
  - _build_node_dict: required fields present (id, name, x, y, z)
  - get_cluster_color: deterministic, different clusters get different colors
  - _calculate_statistical_position: returns a 3-tuple of numbers
"""


class TestGetClusterColor:
    def setup_method(self):
        from app.services.graph_generator import GraphGenerator
        self.gen = GraphGenerator()

    def test_returns_string(self):
        color = self.gen.get_cluster_color("cluster_1")
        assert isinstance(color, str)
        assert color.startswith("#")

    def test_deterministic(self):
        c1 = self.gen.get_cluster_color("cluster_42")
        c2 = self.gen.get_cluster_color("cluster_42")
        assert c1 == c2

    def test_different_clusters_may_differ(self):
        # Not guaranteed to differ for all inputs, but common clusters should
        colors = {self.gen.get_cluster_color(f"cluster_{i}") for i in range(10)}
        assert len(colors) > 1


class TestBuildNodeDict:
    def setup_method(self):
        from app.services.graph_generator import GraphGenerator
        self.gen = GraphGenerator()

    def test_required_fields_present(self):
        table = {"name": "orders", "columns": [], "row_count": 50, "foreign_keys": []}
        node = self.gen._build_node_dict(table, 1.0, 2.0, 3.0, "semantic")
        for field in ("id", "name", "x", "y", "z", "size", "color"):
            assert field in node, f"Missing field: {field}"

    def test_position_matches_input(self):
        table = {"name": "users", "columns": [], "row_count": 0, "foreign_keys": []}
        node = self.gen._build_node_dict(table, 10.0, 20.0, 30.0, "semantic")
        assert node["x"] == 10.0
        assert node["y"] == 20.0
        assert node["z"] == 30.0
