"""
Action Trigger Tool  creates a Decision record and optionally dispatches
notifications (Slack, email) based on confidence and severity thresholds.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, AsyncGenerator, Dict

logger = logging.getLogger(__name__)


class ActionTriggerTool:
    name = "trigger_decision"

    async def execute(
        self, params: Dict[str, Any], memory: Any, connection_id: str
    ) -> AsyncGenerator[Dict, None]:
        severity      = params.get("severity", "info")
        condition     = params.get("condition", "")
        action_types: list = params.get("action_types", [])
        requires_approval = params.get("requires_approval", False)

        # Auto-elevate severity based on anomaly results
        if severity == "auto":
            anomaly_result = memory.get("anomaly_result", {})
            critical_count = anomaly_result.get("critical", 0) if anomaly_result else 0
            severity = "critical" if critical_count > 0 else "warning"

        # Evaluate condition expression (simple key>value form)
        should_trigger = self._evaluate_condition(condition, memory)
        if not should_trigger and condition:
            yield {
                "type":    "result",
                "text":    f"Condition '{condition}' not met  decision not created.",
                "data":    {"triggered": False, "condition": condition},
                "summary": "Condition not met",
            }
            return

        yield {"type": "status", "text": f"Creating {severity.upper()} decision..."}

        try:
            report   = memory.get("final_report", {})
            findings = report.get("key_findings", [])
            recs     = report.get("recommendations", [])

            decision = {
                "id":          str(uuid.uuid4()),
                "severity":    severity,
                "title":       self._generate_title(memory, severity),
                "description": report.get("narrative", "")[:500],
                "findings":    findings,
                "recommended_actions": recs,
                "source_type": "agent",
                "connection_id": connection_id,
                "requires_approval": requires_approval,
                "status":      "pending",
                "action_types": action_types,
            }

            memory.set("decision", decision, source="trigger_decision")

            # Dispatch to decision store (non-blocking)
            try:
                from app.services.decisions.alert_engine import alert_engine
                await alert_engine.ingest_decision(decision)
            except Exception as exc:
                logger.debug("decision store ingest failed (non-critical): %s", exc)

            yield {
                "type":    "result",
                "text":    f"{severity.upper()} decision created: '{decision['title']}'",
                "data":    decision,
                "summary": f"{severity.upper()}  {len(findings)} findings  {len(recs)} recommendations",
            }

        except Exception as exc:
            logger.error("action_trigger failed: %s", exc, exc_info=True)
            yield {"type": "error", "text": f"Decision creation failed: {exc}"}

    def _evaluate_condition(self, condition: str, memory: Any) -> bool:
        if not condition:
            return True
        try:
            # Simple "key > value" / "key < value" parser
            import re
            m = re.match(r"(\w+)\s*([><=!]+)\s*([\d.]+)", condition)
            if not m:
                return True
            key, op, threshold = m.group(1), m.group(2), float(m.group(3))
            actual = memory.get(key)
            if actual is None:
                return True
            val = float(actual)
            return eval(f"{val} {op} {threshold}")     # safe  only numbers/ops
        except Exception:
            return True

    def _generate_title(self, memory: Any, severity: str) -> str:
        table = memory.get("primary_table", "dataset")
        family = memory.get("ml_result", {}).get("family", "analysis")
        anomaly_count = memory.get("anomaly_count", 0)
        if anomaly_count > 0:
            return f"{severity.capitalize()}: {anomaly_count} anomalies in '{table}'"
        return f"Intelligence alert: {family} analysis on '{table}'"

