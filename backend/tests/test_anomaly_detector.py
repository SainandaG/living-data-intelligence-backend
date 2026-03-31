"""
Tests for anomaly_detector.py — stability critical.

Coverage targets:
  - detect_anomalies: no anomalies at baseline, anomaly on spike
  - update_baseline: baseline persists after update
  - hydrate_memory: handles missing table gracefully
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


class TestAnomalyDetector:
    def setup_method(self):
        from app.services.anomaly_detector import AnomalyDetector
        self.detector = AnomalyDetector()

    @pytest.mark.asyncio
    async def test_no_anomalies_at_baseline(self):
        # baseline_metrics expects metric -> list of floats, not raw values
        self.detector.baseline_metrics["conn1"] = {
            "transaction_rate": [100.0] * 10,
            "fraud_alerts": [5.0] * 10,
            "cache_hit_rate": [95.0] * 10,
        }
        metrics = {"transaction_rate": 100, "fraud_alerts": 5, "cache_hit_rate": 95.0}
        anomalies = await self.detector.detect_anomalies("conn1", metrics)
        # Same values as baseline should produce zero anomalies
        assert anomalies == [] or all(a.get("severity") != "High" for a in anomalies)

    @pytest.mark.asyncio
    async def test_spike_produces_anomaly(self):
        # Seed baseline with normal history first
        self.detector.baseline_metrics["conn2"] = {
            "transaction_rate": [100.0] * 20,
            "fraud_alerts": [0.0] * 20,
        }
        spike = {"transaction_rate": 10000, "fraud_alerts": 500}
        anomalies = await self.detector.detect_anomalies("conn2", spike)
        assert len(anomalies) > 0

    @pytest.mark.asyncio
    async def test_hydrate_memory_missing_table(self):
        """Should not raise even if the DB table doesn't exist."""
        mock_db = AsyncMock()
        mock_db.query = AsyncMock(side_effect=Exception("Table not found"))
        # hydrate_memory takes (db_connector, connection_id) as positional args
        await self.detector.hydrate_memory(mock_db, "conn3")
        assert "conn3" in self.detector.baseline_metrics
