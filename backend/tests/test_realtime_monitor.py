"""
Integration tests for realtime_monitor.py — complex multi-DB logic.

Coverage targets:
  - get_realtime_data: returns expected keys
  - _get_wezu_metrics: handles missing batteries table gracefully
  - _get_db_diagnostics: returns defaults when queries fail
  - _has_column: caches result, returns False for missing column
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


class TestRealtimeMonitor:
    def setup_method(self):
        from app.services.realtime_monitor import RealtimeMonitor
        self.monitor = RealtimeMonitor()

    @pytest.mark.asyncio
    async def test_get_realtime_data_returns_required_keys(self):
        mock_conn = {"type": "postgresql"}
        with patch("app.services.realtime_monitor.db_connector") as mock_db:
            mock_db.get_connection = MagicMock(return_value=mock_conn)
            mock_db.query = AsyncMock(return_value=[{"total": 0}])
            result = await self.monitor.get_realtime_data("test_conn")
        assert "data" in result
        assert "health" in result

    @pytest.mark.asyncio
    async def test_wezu_metrics_handles_missing_table(self):
        with patch("app.services.realtime_monitor.db_connector") as mock_db:
            mock_db.query = AsyncMock(side_effect=Exception("relation batteries does not exist"))
            result = await self.monitor._get_wezu_metrics("conn1")
        assert result["active_batteries"] == 0
        assert result["avg_soh"] == 0

    @pytest.mark.asyncio
    async def test_db_diagnostics_returns_defaults_on_failure(self):
        with patch("app.services.realtime_monitor.db_connector") as mock_db:
            mock_db.query = AsyncMock(side_effect=Exception("connection failed"))
            result = await self.monitor._get_db_diagnostics("conn1", "postgresql")
        assert result["cache_hit_rate"] == 99.0
        assert result["active_conns"] == 1

    @pytest.mark.asyncio
    async def test_has_column_returns_false_for_missing(self):
        with patch("app.services.realtime_monitor.db_connector") as mock_db:
            mock_db.validate_identifier = MagicMock(return_value="batteries")
            mock_db.get_connection = MagicMock(return_value={"type": "postgresql"})
            mock_db.query = AsyncMock(return_value=[{"column_name": "soh_percentage"}])
            result = await self.monitor._has_column(mock_db, "conn1", "batteries", "nonexistent_col")
        assert result is False

    @pytest.mark.asyncio
    async def test_has_column_returns_true_for_existing(self):
        with patch("app.services.realtime_monitor.db_connector") as mock_db:
            mock_db.validate_identifier = MagicMock(return_value="batteries")
            mock_db.get_connection = MagicMock(return_value={"type": "postgresql"})
            mock_db.query = AsyncMock(return_value=[{"column_name": "soh_percentage"}])
            result = await self.monitor._has_column(mock_db, "conn1", "batteries", "soh_percentage")
        assert result is True
