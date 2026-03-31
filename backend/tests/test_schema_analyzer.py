"""
Tests for schema_analyzer.py — core feature.

Coverage targets:
  - analyze_schema: returns correct table list, column names, row counts
  - get_analysis_result: returns cached result or None
  - table classification (fact / dimension / reference)
"""
import pytest
from unittest.mock import AsyncMock, patch


class TestSchemaAnalyzer:
    @pytest.mark.asyncio
    async def test_analyze_schema_returns_tables(self):
        from app.services.schema_analyzer import SchemaAnalyzer
        from app.models.schemas import Schema, Table
        analyzer = SchemaAnalyzer()
        mock_schema = Schema(database="test", tables=[Table(name="orders", columns=[], primary_keys=[], foreign_keys=[], row_count=100, numeric_columns=[])], relationships=[])
        
        with patch("app.services.schema_analyzer.db_connector") as mock_db, \
             patch.object(analyzer, "_analyze_postgresql", new=AsyncMock(return_value=mock_schema)):
            mock_db.get_connection.return_value = {"type": "postgresql", "config": {"database": "test"}}
            result = await analyzer.analyze_schema("conn1")
        assert result is not None
        assert len(result.tables) > 0

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
