"""
Tests for schema_analyzer.py — core feature.

Coverage targets:
  - analyze_schema: returns correct table list, column names, row counts
  - get_analysis_result: returns cached result or None
  - table classification (fact / dimension / reference)
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


class TestSchemaAnalyzer:
    @pytest.mark.asyncio
    async def test_analyze_schema_returns_tables(self):
        from app.services.schema_analyzer import SchemaAnalyzer
        analyzer = SchemaAnalyzer()
        mock_tables = [{"name": "orders", "columns": [], "row_count": 100, "foreign_keys": []}]
        with patch.object(analyzer, "_fetch_tables", new=AsyncMock(return_value=mock_tables)):
            result = await analyzer.analyze_schema("conn1")
        assert result is not None

    def test_get_analysis_result_returns_none_for_unknown(self):
        from app.services.schema_analyzer import SchemaAnalyzer
        analyzer = SchemaAnalyzer()
        assert analyzer.get_analysis_result("nonexistent_conn") is None

    def test_get_analysis_result_returns_cached(self):
        from app.services.schema_analyzer import SchemaAnalyzer
        analyzer = SchemaAnalyzer()
        sentinel = object()
        analyzer.analysis_results["conn1"] = sentinel
        assert analyzer.get_analysis_result("conn1") is sentinel
