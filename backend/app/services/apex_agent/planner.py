"""
Agent Planner — converts a natural-language query into a typed, validated
AgentPlan using an LLM with structured output (Pydantic schema enforcement).

Falls back to a deterministic rule-based plan when no LLM key is configured,
so the platform works out-of-the-box in development.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Typed plan schema ─────────────────────────────────────────────────────────

ToolName = Literal[
    "inspect_schema",
    "sample_data",
    "resolve_entity",
    "engineer_features",
    "run_ml",
    "run_automl",
    "detect_anomalies",
    "compute_metric",
    "explain_result",
    "write_insight",
    "trigger_decision",
    "search_memory",
]


class AgentStep(BaseModel):
    index:       int
    tool:        ToolName
    params:      Dict[str, Any]  = Field(default_factory=dict)
    depends_on:  List[int]       = Field(default_factory=list)
    description: str             = ""
    requires_approval: bool      = False


class AgentPlan(BaseModel):
    session_id:    str
    query:         str
    intent:        str           # churn_analysis | anomaly_detection | forecast | segmentation | generic
    steps:         List[AgentStep]
    reasoning:     str
    estimated_duration_s: float  = 30.0


# ── Planner ───────────────────────────────────────────────────────────────────

class AgentPlanner:
    """
    Produces an AgentPlan from a natural-language query.

    Order of resolution:
      1. Google Gemini (GOOGLE_API_KEY)  — structured JSON mode
      2. OpenAI (OPENAI_API_KEY)         — structured JSON mode
      3. Rule-based fallback             — always available
    """

    SYSTEM_PROMPT = """You are APEX, an operational intelligence agent for enterprise databases.
Given a user query and a connection_id, produce a JSON AgentPlan.

Rules:
- Use only the tools: inspect_schema, sample_data, resolve_entity, engineer_features,
  run_ml, run_automl, detect_anomalies, compute_metric, explain_result,
  write_insight, trigger_decision, search_memory.
- Steps that don't depend on each other can run in parallel (depends_on=[]).
- Every plan must end with write_insight.
- For destructive or high-confidence actions, set requires_approval=true on trigger_decision.
- Keep plans concise (4-8 steps for most queries).

Return ONLY valid JSON matching the AgentPlan schema. No prose, no markdown fences."""

    # ── Public API ────────────────────────────────────────────────────────────

    async def plan(
        self,
        query: str,
        session_id: str,
        connection_id: str,
        context: Dict[str, Any] | None = None,
    ) -> AgentPlan:
        """Return a structured AgentPlan for the given query."""
        # Try LLM first
        plan = await self._llm_plan(query, session_id, connection_id, context)
        if plan:
            return plan
        # Deterministic fallback
        return self._rule_plan(query, session_id, connection_id)

    # ── LLM planning ─────────────────────────────────────────────────────────

    async def _llm_plan(
        self,
        query: str,
        session_id: str,
        connection_id: str,
        context: Dict | None,
    ) -> AgentPlan | None:
        prompt = self._build_prompt(query, connection_id, context)

        # Try Gemini
        if os.getenv("GOOGLE_API_KEY"):
            raw = await self._call_gemini(prompt)
            if raw:
                return self._parse(raw, query, session_id)

        # Try OpenAI
        if os.getenv("OPENAI_API_KEY"):
            raw = await self._call_openai(prompt)
            if raw:
                return self._parse(raw, query, session_id)

        return None

    async def _call_gemini(self, prompt: str) -> str | None:
        try:
            import google.generativeai as genai
            genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
            model = genai.GenerativeModel(
                "gemini-1.5-flash",
                generation_config={"response_mime_type": "application/json"},
            )
            resp = model.generate_content(prompt)
            return resp.text
        except Exception as exc:
            logger.warning("Gemini planner failed: %s", exc)
            return None

    async def _call_openai(self, prompt: str) -> str | None:
        try:
            import openai
            client = openai.AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            return resp.choices[0].message.content
        except Exception as exc:
            logger.warning("OpenAI planner failed: %s", exc)
            return None

    def _build_prompt(self, query: str, connection_id: str, context: Dict | None) -> str:
        ctx_str = json.dumps(context or {}, indent=2)[:500]
        return (
            f"{self.SYSTEM_PROMPT}\n\n"
            f"connection_id: {connection_id}\n"
            f"context: {ctx_str}\n\n"
            f"User query: {query}\n\n"
            f"Produce the AgentPlan JSON:"
        )

    def _parse(self, raw: str, query: str, session_id: str) -> AgentPlan | None:
        try:
            # Strip markdown fences if present
            raw = re.sub(r"```(?:json)?", "", raw).strip()
            data = json.loads(raw)
            data.setdefault("session_id", session_id)
            data.setdefault("query", query)
            return AgentPlan(**data)
        except Exception as exc:
            logger.warning("Plan parse failed: %s — raw: %.200s", exc, raw)
            return None

    # ── Rule-based fallback ───────────────────────────────────────────────────

    def _rule_plan(self, query: str, session_id: str, connection_id: str) -> AgentPlan:
        q = query.lower()

        if any(w in q for w in ["churn", "cancel", "attrition", "drop"]):
            return self._churn_plan(session_id, query, connection_id)
        if any(w in q for w in ["anomal", "outlier", "spike", "unusual", "detect"]):
            return self._anomaly_plan(session_id, query, connection_id)
        if any(w in q for w in ["forecast", "predict", "next", "future", "30 day"]):
            return self._forecast_plan(session_id, query, connection_id)
        if any(w in q for w in ["segment", "cluster", "group", "cohort"]):
            return self._segment_plan(session_id, query, connection_id)
        # Generic exploratory
        return self._generic_plan(session_id, query, connection_id)

    def _churn_plan(self, session_id: str, query: str, connection_id: str) -> AgentPlan:
        return AgentPlan(
            session_id=session_id, query=query, intent="churn_analysis",
            reasoning="Detected churn intent — will identify customer + event entities, engineer behavioral features, classify churn, explain drivers.",
            estimated_duration_s=45.0,
            steps=[
                AgentStep(index=0, tool="inspect_schema", description="Discover tables and relationships", params={"connection_id": connection_id}),
                AgentStep(index=1, tool="resolve_entity", description="Find customer and churn event entities", params={"entity_types": ["customer", "subscription", "event"]}, depends_on=[0]),
                AgentStep(index=2, tool="engineer_features", description="Build behavioral features (recency, frequency, tenure)", params={"lookback_days": 90, "feature_types": ["behavioral", "transactional"]}, depends_on=[1]),
                AgentStep(index=3, tool="run_automl", description="Train churn classifier (AutoML)", params={"family": "classification", "target": "auto"}, depends_on=[2]),
                AgentStep(index=4, tool="explain_result", description="SHAP waterfall of top churn drivers", params={"output_type": "shap_waterfall", "top_n": 10}, depends_on=[3]),
                AgentStep(index=5, tool="detect_anomalies", description="Find segments with spike in churn rate", params={"segment_by": "auto"}, depends_on=[3]),
                AgentStep(index=6, tool="write_insight", description="Compose business-readable churn analysis", params={"audience": "business", "include_recommendations": True}, depends_on=[4, 5]),
                AgentStep(index=7, tool="trigger_decision", description="Create HIGH decision if churn > baseline", params={"severity": "high", "condition": "churn_rate > baseline"}, depends_on=[6], requires_approval=True),
            ],
        )

    def _anomaly_plan(self, session_id: str, query: str, connection_id: str) -> AgentPlan:
        return AgentPlan(
            session_id=session_id, query=query, intent="anomaly_detection",
            reasoning="Anomaly/outlier detection — inspect schema, sample data, run statistical anomaly detection, produce ranked anomaly list.",
            estimated_duration_s=20.0,
            steps=[
                AgentStep(index=0, tool="inspect_schema", description="Inspect schema for numeric and event tables", params={"connection_id": connection_id}),
                AgentStep(index=1, tool="sample_data", description="Sample recent data", params={"limit": 2000, "order_by": "recent"}, depends_on=[0]),
                AgentStep(index=2, tool="detect_anomalies", description="Statistical anomaly detection (Z-score + IQR)", params={"methods": ["zscore", "iqr"], "sensitivity": "medium"}, depends_on=[1]),
                AgentStep(index=3, tool="write_insight", description="Summarise anomalies with impact assessment", params={"audience": "ops"}, depends_on=[2]),
                AgentStep(index=4, tool="trigger_decision", description="Alert on critical anomalies", params={"severity": "auto", "action_types": ["slack", "email"]}, depends_on=[3]),
            ],
        )

    def _forecast_plan(self, session_id: str, query: str, connection_id: str) -> AgentPlan:
        return AgentPlan(
            session_id=session_id, query=query, intent="forecast",
            reasoning="Time-series forecasting — detect date+metric columns, fit seasonal model, produce 30-day forecast.",
            estimated_duration_s=25.0,
            steps=[
                AgentStep(index=0, tool="inspect_schema", description="Find timestamp and metric columns", params={"connection_id": connection_id}),
                AgentStep(index=1, tool="sample_data", description="Fetch historical time series", params={"limit": 3000, "order_by": "date_asc"}, depends_on=[0]),
                AgentStep(index=2, tool="run_ml", description="Fit time-series model (trend + seasonality)", params={"family": "timeseries", "algo": "auto", "forecast_days": 30}, depends_on=[1]),
                AgentStep(index=3, tool="write_insight", description="Write forecast summary with confidence intervals", params={"audience": "business", "include_chart_hints": True}, depends_on=[2]),
            ],
        )

    def _segment_plan(self, session_id: str, query: str, connection_id: str) -> AgentPlan:
        return AgentPlan(
            session_id=session_id, query=query, intent="segmentation",
            reasoning="Customer/entity segmentation — cluster by behavioral and demographic features.",
            estimated_duration_s=30.0,
            steps=[
                AgentStep(index=0, tool="inspect_schema", description="Inspect entity and feature tables", params={"connection_id": connection_id}),
                AgentStep(index=1, tool="sample_data", description="Sample full entity population", params={"limit": 4000}, depends_on=[0]),
                AgentStep(index=2, tool="run_automl", description="Auto-cluster with optimal k", params={"family": "clustering", "algo": "auto"}, depends_on=[1]),
                AgentStep(index=3, tool="explain_result", description="Profile each segment by top features", params={"output_type": "cluster_profiles"}, depends_on=[2]),
                AgentStep(index=4, tool="write_insight", description="Business-readable segment descriptions and recommendations", params={"audience": "marketing"}, depends_on=[3]),
            ],
        )

    def _generic_plan(self, session_id: str, query: str, connection_id: str) -> AgentPlan:
        return AgentPlan(
            session_id=session_id, query=query, intent="generic",
            reasoning="Generic exploratory analysis — inspect schema, sample data, run AutoML, explain findings.",
            estimated_duration_s=35.0,
            steps=[
                AgentStep(index=0, tool="inspect_schema", description="Understand schema structure", params={"connection_id": connection_id}),
                AgentStep(index=1, tool="sample_data", description="Sample most relevant table", params={"limit": 2000}, depends_on=[0]),
                AgentStep(index=2, tool="run_automl", description="AutoML on best-matching data", params={"family": "auto"}, depends_on=[1]),
                AgentStep(index=3, tool="explain_result", description="Feature importance analysis", params={"top_n": 10}, depends_on=[2]),
                AgentStep(index=4, tool="write_insight", description="Executive summary with action items", params={"audience": "business"}, depends_on=[3]),
            ],
        )


# Singleton
agent_planner = AgentPlanner()
