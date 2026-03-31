"""
Decisions API — /api/decisions

CRUD for decisions + status update + manual notification dispatch.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


# ── Models ────────────────────────────────────────────────────────────────────

class CreateDecisionRequest(BaseModel):
    title:        str
    description:  str = ""
    severity:     str = "info"      # info | warning | high | critical
    source_type:  str = "manual"
    connection_id: Optional[str] = None
    tenant_id:    str = "default"
    findings:     List[Dict] = []
    recommended_actions: List[Dict] = []
    action_types: List[str] = []    # slack | email | webhook
    requires_approval: bool = False
    confidence:   float = 1.0


class UpdateStatusRequest(BaseModel):
    status:      str            # approved | rejected | actioned
    resolved_by: Optional[str] = None


class DispatchRequest(BaseModel):
    channels: List[str]         # slack | email | webhook


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_decisions(
    tenant_id: str = "default",
    severity:  Optional[str] = None,
    status:    Optional[str] = None,
    limit:     int = 50,
) -> Dict[str, Any]:
    from app.services.decisions.alert_engine import alert_engine
    decisions = alert_engine.list_decisions(
        tenant_id=tenant_id, severity=severity, status=status, limit=limit
    )
    stats = alert_engine.stats(tenant_id=tenant_id)
    return {"decisions": decisions, "stats": stats, "total": len(decisions)}


@router.post("")
async def create_decision(req: CreateDecisionRequest) -> Dict[str, Any]:
    from app.services.decisions.alert_engine import alert_engine
    decision = await alert_engine.create(
        title=req.title,
        description=req.description,
        severity=req.severity,
        source_type=req.source_type,
        connection_id=req.connection_id,
        tenant_id=req.tenant_id,
        findings=req.findings,
        recommended_actions=req.recommended_actions,
        action_types=req.action_types,
        requires_approval=req.requires_approval,
        confidence=req.confidence,
    )
    from dataclasses import asdict
    return asdict(decision)


@router.get("/stats")
async def get_stats(tenant_id: str = "default") -> Dict[str, int]:
    from app.services.decisions.alert_engine import alert_engine
    return alert_engine.stats(tenant_id=tenant_id)


@router.get("/{decision_id}")
async def get_decision(decision_id: str) -> Dict[str, Any]:
    from app.services.decisions.alert_engine import alert_engine
    decision = alert_engine.get_decision(decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found.")
    from dataclasses import asdict
    return asdict(decision)


@router.patch("/{decision_id}/status")
async def update_status(decision_id: str, req: UpdateStatusRequest) -> Dict[str, Any]:
    valid = {"approved", "rejected", "actioned", "pending"}
    if req.status not in valid:
        raise HTTPException(status_code=422, detail=f"Status must be one of {valid}")

    from app.services.decisions.alert_engine import alert_engine
    from app.services.platform.audit_logger import audit_logger, AuditEventType

    decision = await alert_engine.update_status(decision_id, req.status, req.resolved_by)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found.")

    event_map = {
        "approved": AuditEventType.DECISION_APPROVE,
        "rejected": AuditEventType.DECISION_REJECT,
        "actioned": AuditEventType.ACTION_DISPATCH,
    }
    await audit_logger.decision_event(
        event_type=event_map.get(req.status, AuditEventType.DECISION_CREATE),
        decision_id=decision_id,
        user_id=req.resolved_by,
    )

    from dataclasses import asdict
    return asdict(decision)


@router.post("/{decision_id}/dispatch")
async def dispatch_decision(decision_id: str, req: DispatchRequest) -> Dict[str, Any]:
    """Manually trigger notifications for an existing decision."""
    from app.services.decisions.alert_engine import alert_engine
    from app.services.decisions.notification_router import notification_router

    decision = alert_engine.get_decision(decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found.")

    results: Dict[str, bool] = {}
    for channel in req.channels:
        results[channel] = await notification_router.dispatch(channel, decision)

    return {"decision_id": decision_id, "dispatch_results": results}
