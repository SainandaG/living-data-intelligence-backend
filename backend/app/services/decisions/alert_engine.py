"""
Alert Engine — central decision/alert store.

Accepts decisions from:
  - Agent (trigger_decision tool)
  - Anomaly detector service
  - Drift monitor
  - Manual API creation

Dispatches notifications on HIGH/CRITICAL decisions via notification_router.

Persistence: decisions are appended to a JSONL file and reloaded on startup
so the store survives process restarts.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)

_STORE_PATH = Path("data/decisions/decisions.jsonl")


@dataclass
class Decision:
    id:          str
    title:       str
    description: str
    severity:    str          # info | warning | high | critical
    status:      str          # pending | approved | rejected | actioned | expired
    source_type: str          # agent | anomaly | drift | manual
    connection_id: Optional[str]
    tenant_id:   str          = "default"
    confidence:  float        = 1.0
    findings:    List[Dict]   = field(default_factory=list)
    recommended_actions: List[Dict] = field(default_factory=list)
    action_types: List[str]   = field(default_factory=list)   # slack | email | webhook
    requires_approval: bool   = False
    created_at:  float        = field(default_factory=time.time)
    resolved_at: Optional[float] = None
    resolved_by: Optional[str]   = None


class AlertEngine:
    """
    File-backed decision store with async notification dispatch.

    Decisions are written to JSONL on every mutation so that the ring-buffer
    is rebuilt on startup from the last RING_SIZE lines of the file.
    Replace JSONL with a database in Phase 5.
    """

    RING_SIZE = 500

    def __init__(self) -> None:
        self._decisions: Dict[str, Decision] = {}
        self._lock = asyncio.Lock()
        self._store_path = _STORE_PATH
        self._subscribers: Set[asyncio.Queue] = set()
        self._load()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load(self) -> None:
        """Replay the last RING_SIZE lines from the JSONL store on startup."""
        try:
            if not self._store_path.exists():
                return
            lines = self._store_path.read_text(encoding="utf-8").splitlines()
            for line in lines[-self.RING_SIZE:]:
                line = line.strip()
                if not line:
                    continue
                try:
                    raw = json.loads(line)
                    d = Decision(**{k: raw[k] for k in Decision.__dataclass_fields__ if k in raw})
                    self._decisions[d.id] = d
                except Exception as exc:
                    logger.warning("alert_engine: skipping corrupt record: %s", exc)
            logger.info("alert_engine: loaded %d decisions from disk", len(self._decisions))
        except Exception as exc:
            logger.error("alert_engine: failed to load from disk: %s", exc)

    def _append(self, decision: Decision) -> None:
        """Append or update a decision record in the JSONL file."""
        try:
            self._store_path.parent.mkdir(parents=True, exist_ok=True)
            with self._store_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(asdict(decision)) + "\n")
        except Exception as exc:
            logger.error("alert_engine: failed to persist decision %s: %s", decision.id, exc)

    def _rewrite(self) -> None:
        """Rewrite the full store after a status update (compact on the fly)."""
        try:
            self._store_path.parent.mkdir(parents=True, exist_ok=True)
            with self._store_path.open("w", encoding="utf-8") as fh:
                for d in self._decisions.values():
                    fh.write(json.dumps(asdict(d)) + "\n")
        except Exception as exc:
            logger.error("alert_engine: failed to rewrite store: %s", exc)

    # ── SSE Pub/Sub ───────────────────────────────────────────────────────────

    def subscribe(self) -> "asyncio.Queue[Dict]":
        """Register a new SSE subscriber. Returns a queue to read events from."""
        q: asyncio.Queue[Dict] = asyncio.Queue(maxsize=100)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: "asyncio.Queue[Dict]") -> None:
        self._subscribers.discard(q)

    def _broadcast(self, event: Dict[str, Any]) -> None:
        """Push an event to all connected SSE subscribers (non-blocking)."""
        dead: Set[asyncio.Queue] = set()
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                dead.add(q)
        self._subscribers -= dead

    # ── Public API ────────────────────────────────────────────────────────────

    async def ingest_decision(self, raw: Dict[str, Any]) -> Decision:
        """Accept a raw dict (from agent or anomaly detector) and store it."""
        decision = Decision(
            id=raw.get("id", str(uuid.uuid4())),
            title=raw.get("title", "Untitled"),
            description=raw.get("description", ""),
            severity=raw.get("severity", "info"),
            status=raw.get("status", "pending"),
            source_type=raw.get("source_type", "manual"),
            connection_id=raw.get("connection_id"),
            tenant_id=raw.get("tenant_id", "default"),
            confidence=float(raw.get("confidence", 1.0)),
            findings=raw.get("findings", []),
            recommended_actions=raw.get("recommended_actions", []),
            action_types=raw.get("action_types", []),
            requires_approval=raw.get("requires_approval", False),
        )

        async with self._lock:
            self._decisions[decision.id] = decision
            # Ring-buffer eviction
            if len(self._decisions) > self.RING_SIZE:
                oldest_key = min(self._decisions, key=lambda k: self._decisions[k].created_at)
                del self._decisions[oldest_key]
            self._append(decision)

        logger.info("decision_ingested id=%s severity=%s title='%s'",
                    decision.id, decision.severity, decision.title[:60])

        self._broadcast({"type": "decision_created", "decision": asdict(decision)})

        # Auto-dispatch notifications for high/critical (non-blocking)
        if decision.severity in ("high", "critical") and not decision.requires_approval:
            asyncio.ensure_future(self._auto_dispatch(decision))

        return decision

    async def create(
        self,
        title: str,
        description: str,
        severity: str,
        source_type: str = "manual",
        connection_id: str | None = None,
        tenant_id: str = "default",
        findings: List[Dict] | None = None,
        recommended_actions: List[Dict] | None = None,
        action_types: List[str] | None = None,
        requires_approval: bool = False,
        confidence: float = 1.0,
    ) -> Decision:
        raw = {
            "title": title, "description": description, "severity": severity,
            "source_type": source_type, "connection_id": connection_id,
            "tenant_id": tenant_id, "findings": findings or [],
            "recommended_actions": recommended_actions or [],
            "action_types": action_types or [], "requires_approval": requires_approval,
            "confidence": confidence,
        }
        return await self.ingest_decision(raw)

    def list_decisions(
        self,
        tenant_id: str = "default",
        severity: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> List[Dict]:
        decisions = [
            asdict(d) for d in self._decisions.values()
            if d.tenant_id == tenant_id
        ]
        if severity:
            decisions = [d for d in decisions if d["severity"] == severity]
        if status:
            decisions = [d for d in decisions if d["status"] == status]
        decisions.sort(key=lambda d: d["created_at"], reverse=True)
        return decisions[:limit]

    def get_decision(self, decision_id: str) -> Decision | None:
        return self._decisions.get(decision_id)

    async def update_status(
        self,
        decision_id: str,
        status: str,
        resolved_by: str | None = None,
    ) -> Decision | None:
        async with self._lock:
            d = self._decisions.get(decision_id)
            if not d:
                return None
            d.status = status
            d.resolved_by = resolved_by
            d.resolved_at = time.time()
            self._rewrite()
        logger.info("decision_updated id=%s status=%s", decision_id, status)
        self._broadcast({"type": "decision_updated", "decision": asdict(d)})
        return d

    def stats(self, tenant_id: str = "default") -> Dict[str, int]:
        all_d = [d for d in self._decisions.values() if d.tenant_id == tenant_id]
        return {
            "total":    len(all_d),
            "pending":  sum(1 for d in all_d if d.status == "pending"),
            "critical": sum(1 for d in all_d if d.severity == "critical"),
            "high":     sum(1 for d in all_d if d.severity == "high"),
        }

    # ── Internal dispatch ─────────────────────────────────────────────────────

    async def _auto_dispatch(self, decision: Decision) -> None:
        try:
            from app.services.decisions.notification_router import notification_router
            for action_type in decision.action_types:
                await notification_router.dispatch(action_type, decision)
        except Exception as exc:
            logger.warning("auto_dispatch failed id=%s: %s", decision.id, exc)


# Singleton
alert_engine = AlertEngine()
