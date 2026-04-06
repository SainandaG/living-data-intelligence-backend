"""
APEX Agent API — /api/apex/agent

Two endpoints:
  POST /api/apex/agent/run      → SSE stream (plan + step events)
  GET  /api/apex/agent/sessions → list past sessions
  GET  /api/apex/agent/sessions/{id} → session detail + memory
"""
from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

_SESSION_STORE = Path("data/agent_sessions/_index.jsonl")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/apex/agent", tags=["apex-agent"])


# ── Request / response models ─────────────────────────────────────────────────

class AgentRunRequest(BaseModel):
    query:         str
    connection_id: str
    context:       Optional[Dict[str, Any]] = None
    tenant_id:     str = "default"
    user_id:       Optional[str] = None


class SessionSummary(BaseModel):
    session_id:  str
    query:       str
    intent:      str
    step_count:  int
    status:      str
    created_at:  float


# ── File-backed session store ─────────────────────────────────────────────────

_sessions: Dict[str, Dict] = {}
_SESSION_MAX = 200   # cap index to last N sessions


def _load_sessions() -> None:
    """Replay session index from disk on startup (last SESSION_MAX entries)."""
    try:
        if not _SESSION_STORE.exists():
            return
        lines = _SESSION_STORE.read_text(encoding="utf-8").splitlines()
        for line in lines[-_SESSION_MAX:]:
            line = line.strip()
            if not line:
                continue
            try:
                sess = json.loads(line)
                _sessions[sess["session_id"]] = sess
            except Exception as e:
                logger.warning("apex_agent: skipping corrupt session line: %s", e)
        logger.info("apex_agent: loaded %d sessions from disk", len(_sessions))
    except Exception as exc:
        logger.error("apex_agent: session load failed: %s", exc)


def _persist_session(sess: Dict) -> None:
    try:
        _SESSION_STORE.parent.mkdir(parents=True, exist_ok=True)
        with _SESSION_STORE.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(sess) + "\n")
    except Exception as exc:
        logger.error("apex_agent: session persist failed: %s", exc)


# Hydrate on import
_load_sessions()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/run")
async def run_agent(req: AgentRunRequest, request: Request):
    """
    Start an agent run.  Returns a Server-Sent Events stream.

    Each event is a JSON object on its own line prefixed with "data: ".
    The stream ends with a "plan_done" event.

    Frontend usage:
        const es = new EventSource('/api/apex/agent/run', {method:'POST', body: JSON.stringify(req)});
    """
    session_id = str(uuid.uuid4())

    async def event_stream():
        from app.services.apex_agent.planner import agent_planner
        from app.services.apex_agent.executor import AgentExecutor
        from app.services.apex_agent.memory import AgentMemory
        from app.services.platform.audit_logger import audit_logger, AuditEventType

        memory   = AgentMemory(session_id)
        executor = AgentExecutor()

        try:
            # Planning phase
            yield _sse({"type": "planning", "text": f"Planning analysis for: {req.query}"})

            plan = await agent_planner.plan(
                query=req.query,
                session_id=session_id,
                connection_id=req.connection_id,
                context=req.context,
            )

            # Persist session
            _sess_record = {
                "session_id":  session_id,
                "query":       req.query,
                "intent":      plan.intent,
                "step_count":  len(plan.steps),
                "status":      "running",
                "tenant_id":   req.tenant_id,
                "user_id":     req.user_id,
                "connection_id": req.connection_id,
                "created_at":  __import__("time").time(),
            }
            _sessions[session_id] = _sess_record
            _persist_session(_sess_record)

            await audit_logger.log(
                __import__("app.services.platform.audit_logger", fromlist=["AuditEvent"]).AuditEvent(
                    event_type=AuditEventType.AGENT_SESSION,
                    user_id=req.user_id,
                    session_id=session_id,
                    metadata={"intent": plan.intent, "query": req.query[:200]},
                )
            )

            # Execution phase — stream each event
            async for event in executor.execute(plan, req.connection_id, memory):
                # Audit tool calls
                if event.get("type") == "step_done":
                    await audit_logger.agent_step(
                        session_id=session_id,
                        step_index=event.get("step_index", 0),
                        tool=event.get("tool", ""),
                        duration_ms=event.get("elapsed_ms", 0),
                        user_id=req.user_id,
                    )
                yield _sse(event)

            _sessions[session_id]["status"] = "completed"
            _sessions[session_id]["memory"] = memory.all_facts()
            _persist_session(_sessions[session_id])

        except Exception as exc:
            logger.error("agent run failed session=%s: %s", session_id, exc, exc_info=True)
            if session_id in _sessions:
                _sessions[session_id]["status"] = "failed"
                _persist_session(_sessions[session_id])
            yield _sse({"type": "error", "text": str(exc)})
        finally:
            yield _sse({"type": "stream_end"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":        "keep-alive",
        },
    )


@router.get("/sessions")
async def list_sessions(
    tenant_id: str = "default",
    limit: int = 20,
) -> Dict[str, Any]:
    """Return recent agent sessions for this tenant."""
    sessions = [
        s for s in _sessions.values()
        if s.get("tenant_id") == tenant_id
    ]
    sessions.sort(key=lambda s: s.get("created_at", 0), reverse=True)
    return {"sessions": sessions[:limit], "total": len(sessions)}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> Dict[str, Any]:
    """Return full session detail including memory."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str) -> Dict[str, str]:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    del _sessions[session_id]
    return {"status": "deleted"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sse(data: Dict[str, Any]) -> str:
    """Format a dict as an SSE data line."""
    try:
        payload = json.dumps(data, default=str)
    except Exception:
        payload = json.dumps({"type": "error", "text": "Serialisation error"})
    return f"data: {payload}\n\n"
