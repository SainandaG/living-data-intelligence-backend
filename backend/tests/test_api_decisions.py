"""
Integration tests for /api/decisions endpoints.

Uses FastAPI TestClient against an isolated router — no DB, no auth middleware.
The alert_engine uses in-memory state so tests are self-contained.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.decisions import router


@pytest.fixture(scope="module")
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_engine():
    """Clear alert_engine state between tests to prevent cross-test contamination."""
    from app.services.decisions.alert_engine import alert_engine
    alert_engine._decisions.clear()
    yield
    alert_engine._decisions.clear()


# ── List / Stats (empty state) ────────────────────────────────────────────────

class TestListDecisions:
    def test_list_returns_empty_on_fresh_state(self, client):
        resp = client.get("/api/decisions")
        assert resp.status_code == 200
        body = resp.json()
        assert "decisions" in body
        assert body["total"] == 0

    def test_stats_returns_zeros_on_fresh_state(self, client):
        resp = client.get("/api/decisions/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, dict)
        # Must have numeric values
        assert all(isinstance(v, int) for v in body.values())


# ── Create ────────────────────────────────────────────────────────────────────

class TestCreateDecision:
    def test_create_minimal(self, client):
        payload = {"title": "Test Alert", "severity": "info"}
        resp = client.post("/api/decisions", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "Test Alert"
        assert body["severity"] == "info"
        assert "id" in body

    def test_create_with_findings(self, client):
        payload = {
            "title": "Anomaly Detected",
            "description": "Unusual spike in orders table",
            "severity": "high",
            "findings": [{"metric": "row_count", "value": 99999, "expected": 1000}],
            "recommended_actions": [{"action": "investigate", "priority": "P1"}],
            "confidence": 0.92,
        }
        resp = client.post("/api/decisions", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["confidence"] == 0.92
        assert len(body["findings"]) == 1

    def test_create_and_list(self, client):
        client.post("/api/decisions", json={"title": "A"})
        client.post("/api/decisions", json={"title": "B"})
        resp = client.get("/api/decisions")
        assert resp.json()["total"] >= 2

    def test_create_populates_stats(self, client):
        client.post("/api/decisions", json={"title": "Stats test", "severity": "critical"})
        resp = client.get("/api/decisions/stats")
        stats = resp.json()
        assert stats.get("total", 0) >= 1


# ── Get by ID ─────────────────────────────────────────────────────────────────

class TestGetDecision:
    def test_get_existing(self, client):
        create_resp = client.post("/api/decisions", json={"title": "Fetchable"})
        decision_id = create_resp.json()["id"]

        resp = client.get(f"/api/decisions/{decision_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == decision_id

    def test_get_nonexistent_returns_404(self, client):
        resp = client.get("/api/decisions/does-not-exist-xyz")
        assert resp.status_code == 404


# ── Status Update ─────────────────────────────────────────────────────────────

class TestUpdateStatus:
    def test_approve_decision(self, client):
        create = client.post("/api/decisions", json={"title": "To Approve", "requires_approval": True})
        did = create.json()["id"]

        resp = client.patch(f"/api/decisions/{did}/status", json={"status": "approved", "resolved_by": "admin"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

    def test_reject_decision(self, client):
        create = client.post("/api/decisions", json={"title": "To Reject"})
        did = create.json()["id"]

        resp = client.patch(f"/api/decisions/{did}/status", json={"status": "rejected"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

    def test_invalid_status_returns_422(self, client):
        create = client.post("/api/decisions", json={"title": "Bad Status"})
        did = create.json()["id"]
        resp = client.patch(f"/api/decisions/{did}/status", json={"status": "exploded"})
        assert resp.status_code == 422

    def test_update_nonexistent_returns_404(self, client):
        resp = client.patch("/api/decisions/ghost-id/status", json={"status": "approved"})
        assert resp.status_code == 404


# ── Filtering ─────────────────────────────────────────────────────────────────

class TestFiltering:
    def test_filter_by_severity(self, client):
        client.post("/api/decisions", json={"title": "Low sev", "severity": "info"})
        client.post("/api/decisions", json={"title": "High sev", "severity": "critical"})

        resp = client.get("/api/decisions?severity=critical")
        body = resp.json()
        assert all(d["severity"] == "critical" for d in body["decisions"])

    def test_limit_respected(self, client):
        for i in range(5):
            client.post("/api/decisions", json={"title": f"Decision {i}"})
        resp = client.get("/api/decisions?limit=2")
        assert len(resp.json()["decisions"]) <= 2
