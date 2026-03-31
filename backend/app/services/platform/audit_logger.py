"""
Audit Logger — structured event logging for every data read, agent step,
ML run, and action dispatch. Append-only, non-blocking.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class AuditEventType(str, Enum):
    # Data access
    DATA_QUERY     = "data.query"
    DATA_SAMPLE    = "data.sample"
    SCHEMA_READ    = "schema.read"

    # ML
    ML_JOB_START   = "ml.job_start"
    ML_JOB_DONE    = "ml.job_done"
    ML_JOB_FAIL    = "ml.job_fail"
    MODEL_PROMOTE  = "model.promote"
    MODEL_INFER    = "model.infer"

    # Agent
    AGENT_SESSION  = "agent.session_start"
    AGENT_STEP     = "agent.step"
    AGENT_TOOL     = "agent.tool_call"

    # Decisions
    DECISION_CREATE  = "decision.create"
    DECISION_APPROVE = "decision.approve"
    DECISION_REJECT  = "decision.reject"
    ACTION_DISPATCH  = "action.dispatch"
    ACTION_DELIVER   = "action.deliver"

    # Workspace
    WORKSPACE_CREATE = "workspace.create"
    WORKSPACE_UPDATE = "workspace.update"


@dataclass
class AuditEvent:
    event_type:    str
    connection_id: Optional[str]          = None
    user_id:       Optional[str]          = None
    session_id:    Optional[str]          = None
    resource_type: Optional[str]          = None
    resource_id:   Optional[str]          = None
    query_text:    Optional[str]          = None   # SQL — never raw user input
    row_count:     Optional[int]          = None
    duration_ms:   Optional[float]        = None
    metadata:      Dict[str, Any]         = field(default_factory=dict)
    ts:            str                    = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AuditLogger:
    """
    Non-blocking structured audit logger.
    Writes to Python logger (JSON) and an internal in-memory ring buffer
    (last 1 000 events) readable via /api/audit.
    """

    RING_SIZE = 1_000

    def __init__(self) -> None:
        self._ring: list[dict] = []
        self._lock = asyncio.Lock()

    # ── Public API ────────────────────────────────────────────────────────────

    async def log(self, event: AuditEvent) -> None:
        payload = asdict(event)
        # Structured JSON to app logger (non-blocking)
        logger.info("AUDIT %s", json.dumps(payload))
        async with self._lock:
            self._ring.append(payload)
            if len(self._ring) > self.RING_SIZE:
                self._ring.pop(0)

    def log_sync(self, event: AuditEvent) -> None:
        """Fire-and-forget variant safe to call from sync code."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(self.log(event))
            else:
                loop.run_until_complete(self.log(event))
        except RuntimeError:
            payload = asdict(event)
            logger.info("AUDIT %s", json.dumps(payload))

    def recent(self, limit: int = 100) -> list[dict]:
        return list(reversed(self._ring[-limit:]))

    # ── Convenience helpers ───────────────────────────────────────────────────

    async def data_query(
        self,
        connection_id: str,
        query_text: str,
        row_count: int,
        duration_ms: float,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> None:
        await self.log(AuditEvent(
            event_type=AuditEventType.DATA_QUERY,
            connection_id=connection_id,
            user_id=user_id,
            session_id=session_id,
            query_text=query_text[:500],   # cap length
            row_count=row_count,
            duration_ms=duration_ms,
        ))

    async def ml_job(
        self,
        event_type: AuditEventType,
        job_id: str,
        connection_id: str,
        algo: str,
        duration_ms: float | None = None,
        user_id: str | None = None,
        metrics: Dict[str, Any] | None = None,
    ) -> None:
        await self.log(AuditEvent(
            event_type=event_type,
            connection_id=connection_id,
            user_id=user_id,
            resource_type="ml_job",
            resource_id=job_id,
            duration_ms=duration_ms,
            metadata={"algo": algo, **(metrics or {})},
        ))

    async def agent_step(
        self,
        session_id: str,
        step_index: int,
        tool: str,
        duration_ms: float,
        user_id: str | None = None,
    ) -> None:
        await self.log(AuditEvent(
            event_type=AuditEventType.AGENT_STEP,
            user_id=user_id,
            session_id=session_id,
            resource_type="agent_step",
            resource_id=f"{session_id}:{step_index}",
            duration_ms=duration_ms,
            metadata={"tool": tool, "step_index": step_index},
        ))

    async def decision_event(
        self,
        event_type: AuditEventType,
        decision_id: str,
        user_id: str | None = None,
        metadata: Dict[str, Any] | None = None,
    ) -> None:
        await self.log(AuditEvent(
            event_type=event_type,
            user_id=user_id,
            resource_type="decision",
            resource_id=decision_id,
            metadata=metadata or {},
        ))


# Singleton
audit_logger = AuditLogger()
