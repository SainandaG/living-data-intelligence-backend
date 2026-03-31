"""
Integration tests for /api/apex/agent endpoints.

Tests cover:
  - Session CRUD (list, get, delete)
  - Agent run endpoint: SSE stream structure, event types, error handling
  - Plan validation (AgentPlan/AgentStep model integrity)

The /run endpoint spawns LLM calls, so those are patched to use the
deterministic rule-based fallback planner (no API keys required in CI).
"""
import json
import pytest
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.apex_agent import router, _sessions
from app.services.apex_agent.planner import AgentPlan, AgentStep


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_sessions():
    _sessions.clear()
    yield
    _sessions.clear()


def _minimal_plan(session_id: str = "test-session") -> AgentPlan:
    return AgentPlan(
        session_id=session_id,
        query="test query",
        intent="generic",
        steps=[
            AgentStep(index=0, tool="inspect_schema", params={}, description="Inspect schema"),
        ],
        reasoning="unit test plan",
        estimated_duration_s=5,
    )


# ── Sessions: list, get, delete ───────────────────────────────────────────────

class TestSessionsCRUD:
    def test_list_empty(self, client):
        resp = client.get("/api/apex/agent/sessions")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_get_nonexistent_404(self, client):
        resp = client.get("/api/apex/agent/sessions/ghost-session")
        assert resp.status_code == 404

    def test_delete_nonexistent_404(self, client):
        resp = client.delete("/api/apex/agent/sessions/ghost-session")
        assert resp.status_code == 404

    def test_delete_existing(self, client):
        _sessions["sess-abc"] = {
            "session_id": "sess-abc",
            "query": "test",
            "intent": "generic",
            "step_count": 1,
            "status": "completed",
            "tenant_id": "default",
            "user_id": None,
            "connection_id": "conn_1",
            "created_at": 0.0,
        }
        resp = client.delete("/api/apex/agent/sessions/sess-abc")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"
        assert "sess-abc" not in _sessions

    def test_list_filters_by_tenant(self, client):
        _sessions["s1"] = {"session_id": "s1", "tenant_id": "tenantA", "query": "q", "intent": "i",
                           "step_count": 0, "status": "completed", "user_id": None,
                           "connection_id": "c", "created_at": 1.0}
        _sessions["s2"] = {"session_id": "s2", "tenant_id": "tenantB", "query": "q", "intent": "i",
                           "step_count": 0, "status": "completed", "user_id": None,
                           "connection_id": "c", "created_at": 2.0}
        resp = client.get("/api/apex/agent/sessions?tenant_id=tenantA")
        body = resp.json()
        assert all(s["tenant_id"] == "tenantA" for s in body["sessions"])


# ── Agent Run: SSE stream ─────────────────────────────────────────────────────

class TestAgentRunStream:
    def test_run_returns_sse_content_type(self, client):
        """Endpoint should always return text/event-stream."""
        plan = _minimal_plan()

        async def fake_execute(p, conn, mem):
            yield {"type": "plan_start", "steps": []}
            yield {"type": "plan_done", "report": {"narrative": "done"}}

        with patch("app.services.apex_agent.planner.agent_planner.plan", new_callable=AsyncMock, return_value=plan), \
             patch("app.services.apex_agent.executor.AgentExecutor.execute", side_effect=fake_execute):

            with client.stream("POST", "/api/apex/agent/run", json={
                "query": "find churn drivers",
                "connection_id": "conn_test",
            }) as resp:
                assert "text/event-stream" in resp.headers["content-type"]

    def test_run_emits_planning_event(self, client):
        plan = _minimal_plan()

        async def fake_execute(p, conn, mem):
            yield {"type": "plan_done", "report": {}}

        with patch("app.services.apex_agent.planner.agent_planner.plan", new_callable=AsyncMock, return_value=plan), \
             patch("app.services.apex_agent.executor.AgentExecutor.execute", side_effect=fake_execute):

            lines = []
            with client.stream("POST", "/api/apex/agent/run", json={
                "query": "test query",
                "connection_id": "conn_test",
            }) as resp:
                for line in resp.iter_lines():
                    lines.append(line)

            data_lines = [l for l in lines if l.startswith("data:")]
            event_types = []
            for dl in data_lines:
                try:
                    event_types.append(json.loads(dl[5:].strip())["type"])
                except Exception:
                    pass

            assert "planning" in event_types
            assert "stream_end" in event_types

    def test_run_emits_stream_end_on_error(self, client):
        """Even when the planner raises, stream_end must be emitted."""
        with patch("app.services.apex_agent.planner.agent_planner.plan",
                   new_callable=AsyncMock, side_effect=RuntimeError("LLM unavailable")):

            lines = []
            with client.stream("POST", "/api/apex/agent/run", json={
                "query": "broken query",
                "connection_id": "conn_test",
            }) as resp:
                for line in resp.iter_lines():
                    lines.append(line)

            data_lines = [l for l in lines if l.startswith("data:")]
            event_types = [json.loads(dl[5:].strip())["type"] for dl in data_lines
                           if dl.strip() != "data:"]

            assert "error" in event_types
            assert "stream_end" in event_types


# ── AgentPlan model integrity ─────────────────────────────────────────────────

class TestAgentPlanModel:
    def test_plan_serialises(self):
        plan = _minimal_plan("sess-001")
        dumped = plan.model_dump()
        assert dumped["session_id"] == "sess-001"
        assert len(dumped["steps"]) == 1
        assert dumped["steps"][0]["tool"] == "inspect_schema"

    def test_step_defaults(self):
        step = AgentStep(index=2, tool="sample_data", params={"limit": 100}, description="Sample rows")
        assert step.depends_on == []
        assert step.requires_approval is False

    def test_step_with_deps(self):
        step = AgentStep(index=1, tool="run_ml", params={}, description="Run ML", depends_on=[0])
        assert 0 in step.depends_on
