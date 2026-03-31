"""
Integration tests for /api/workspace endpoints.

Uses FastAPI TestClient against an isolated router.
Workspace files are written to a tmp directory to avoid polluting real data/.
"""
import json
import pytest
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    """Create a test client with workspace storage redirected to a temp dir."""
    import app.api.workspace as ws_module

    # Redirect workspace storage to an isolated temp dir for this test session
    tmp_dir = tmp_path_factory.mktemp("workspaces")
    ws_module.WORKSPACE_DIR = tmp_dir
    ws_module._workspaces.clear()

    app = FastAPI()
    app.include_router(ws_module.router)
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_workspaces():
    """Clear in-memory state before each test."""
    import app.api.workspace as ws_module
    ws_module._workspaces.clear()
    yield
    ws_module._workspaces.clear()


# ── Create / List ─────────────────────────────────────────────────────────────

class TestCreateWorkspace:
    def test_create_minimal(self, client):
        resp = client.post("/api/workspace", json={"title": "My Investigation"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "My Investigation"
        assert body["status"] == "open"
        assert "id" in body
        assert "created_at" in body

    def test_create_with_connection(self, client):
        resp = client.post("/api/workspace", json={
            "title": "DB Investigation",
            "connection_id": "conn_abc",
            "tenant_id": "tenant_1",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["connection_id"] == "conn_abc"
        assert body["tenant_id"] == "tenant_1"

    def test_list_after_create(self, client):
        client.post("/api/workspace", json={"title": "WS1", "tenant_id": "t1"})
        client.post("/api/workspace", json={"title": "WS2", "tenant_id": "t1"})
        resp = client.get("/api/workspace?tenant_id=t1")
        assert resp.status_code == 200
        assert resp.json()["total"] >= 2

    def test_list_isolates_by_tenant(self, client):
        client.post("/api/workspace", json={"title": "For T1", "tenant_id": "tenant_A"})
        client.post("/api/workspace", json={"title": "For T2", "tenant_id": "tenant_B"})
        resp = client.get("/api/workspace?tenant_id=tenant_A")
        body = resp.json()
        assert all(w["tenant_id"] == "tenant_A" for w in body["workspaces"])


# ── Get / Update ──────────────────────────────────────────────────────────────

class TestGetUpdateWorkspace:
    def test_get_existing(self, client):
        wid = client.post("/api/workspace", json={"title": "Fetchable"}).json()["id"]
        resp = client.get(f"/api/workspace/{wid}")
        assert resp.status_code == 200
        assert resp.json()["id"] == wid

    def test_get_nonexistent_404(self, client):
        resp = client.get("/api/workspace/no-such-workspace")
        assert resp.status_code == 404

    def test_update_title(self, client):
        wid = client.post("/api/workspace", json={"title": "Old Title"}).json()["id"]
        resp = client.patch(f"/api/workspace/{wid}", json={"title": "New Title"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "New Title"

    def test_update_status_to_concluded(self, client):
        wid = client.post("/api/workspace", json={"title": "Conclude me"}).json()["id"]
        resp = client.patch(f"/api/workspace/{wid}", json={"status": "concluded"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "concluded"

    def test_update_canvas_state(self, client):
        wid = client.post("/api/workspace", json={"title": "Canvas"}).json()["id"]
        canvas = {"nodes": [{"id": "n1", "type": "table"}], "edges": []}
        resp = client.patch(f"/api/workspace/{wid}", json={"canvas_state": canvas})
        assert resp.status_code == 200
        assert resp.json()["canvas_state"]["nodes"][0]["id"] == "n1"


# ── Evidence Chain ────────────────────────────────────────────────────────────

class TestEvidence:
    def test_add_evidence(self, client):
        wid = client.post("/api/workspace", json={"title": "Evidence WS"}).json()["id"]
        evidence = {
            "type": "finding",
            "title": "High null rate on email column",
            "content": {"column": "email", "null_pct": 0.42},
        }
        resp = client.post(f"/api/workspace/{wid}/evidence", json=evidence)
        assert resp.status_code == 200
        item = resp.json()
        assert item["type"] == "finding"
        assert "id" in item

    def test_add_multiple_evidence_items(self, client):
        wid = client.post("/api/workspace", json={"title": "Multi Evidence"}).json()["id"]
        for i in range(3):
            client.post(f"/api/workspace/{wid}/evidence", json={
                "type": "annotation",
                "title": f"Note {i}",
                "content": {"text": f"observation {i}"},
            })
        ws = client.get(f"/api/workspace/{wid}").json()
        assert len(ws["evidence_chain"]) == 3

    def test_remove_evidence(self, client):
        wid = client.post("/api/workspace", json={"title": "Remove Evidence"}).json()["id"]
        eid = client.post(f"/api/workspace/{wid}/evidence", json={
            "type": "chart", "title": "Feature Importance", "content": {}
        }).json()["id"]

        resp = client.delete(f"/api/workspace/{wid}/evidence/{eid}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "removed"

        ws = client.get(f"/api/workspace/{wid}").json()
        assert not any(e["id"] == eid for e in ws["evidence_chain"])

    def test_remove_nonexistent_evidence_is_no_op(self, client):
        wid = client.post("/api/workspace", json={"title": "No-op remove"}).json()["id"]
        resp = client.delete(f"/api/workspace/{wid}/evidence/ghost-id")
        # Should not 500 — evidence just wasn't there
        assert resp.status_code == 200


# ── Delete (soft archive) ─────────────────────────────────────────────────────

class TestDeleteWorkspace:
    def test_delete_archives(self, client):
        wid = client.post("/api/workspace", json={"title": "To Delete"}).json()["id"]
        resp = client.delete(f"/api/workspace/{wid}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"

    def test_delete_nonexistent_404(self, client):
        resp = client.delete("/api/workspace/ghost-ws")
        assert resp.status_code == 404
