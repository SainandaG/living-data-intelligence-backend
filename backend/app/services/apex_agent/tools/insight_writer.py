"""
Insight Writer Tool — synthesises all memory facts into a structured,
business-readable analysis report.

Uses LLM when available; falls back to template-based generation.
"""
from __future__ import annotations

import logging
import os
from typing import Any, AsyncGenerator, Dict

logger = logging.getLogger(__name__)


class InsightWriterTool:
    name = "write_insight"

    async def execute(
        self, params: Dict[str, Any], memory: Any, connection_id: str
    ) -> AsyncGenerator[Dict, None]:
        yield {"type": "status", "text": "Composing intelligence report..."}

        audience = params.get("audience", "business")
        include_recs = params.get("include_recommendations", True)

        try:
            ml_result  = memory.get("ml_result", {})
            anomalies  = memory.get("anomaly_result", {})
            entity_map = memory.get("entity_map", {})
            insights   = memory.get("ml_insights", [])
            metrics    = memory.get("ml_metrics", {})
            fi         = memory.get("ml_fi", [])
            query      = memory.get("original_query", "")

            # Try LLM synthesis
            llm_text = await self._llm_synthesis(
                query=query, ml_result=ml_result, anomalies=anomalies,
                insights=insights, metrics=metrics, fi=fi,
                audience=audience, include_recs=include_recs,
            )

            if llm_text:
                report_text = llm_text
            else:
                report_text = self._template_synthesis(
                    ml_result=ml_result, anomalies=anomalies,
                    insights=insights, metrics=metrics, fi=fi,
                    audience=audience, include_recs=include_recs,
                )

            # Build structured report object
            top_feature = fi[0]["name"] if fi else "N/A"
            top_anomaly_col = anomalies.get("anomalies", [{}])[0].get("column", "N/A") if anomalies else "N/A"

            report = {
                "narrative":    report_text,
                "key_findings": _extract_key_findings(ml_result, anomalies, fi, metrics),
                "top_feature":  top_feature,
                "top_anomaly":  top_anomaly_col,
                "audience":     audience,
                "recommendations": _generate_recommendations(ml_result, anomalies, metrics) if include_recs else [],
            }

            memory.set("final_report", report, source="write_insight")

            yield {
                "type":    "result",
                "text":    report_text[:600],
                "data":    report,
                "summary": f"Report ready · {len(report['key_findings'])} findings · {len(report['recommendations'])} recommendations",
            }

        except Exception as exc:
            logger.error("insight_writer failed: %s", exc, exc_info=True)
            yield {"type": "error", "text": f"Insight writing failed: {exc}"}

    # ── LLM synthesis ─────────────────────────────────────────────────────────

    async def _llm_synthesis(
        self, query: str, ml_result: Dict, anomalies: Dict,
        insights: list, metrics: Dict, fi: list,
        audience: str, include_recs: bool,
    ) -> str | None:
        if not os.getenv("GOOGLE_API_KEY") and not os.getenv("OPENAI_API_KEY"):
            return None

        context = {
            "query":     query,
            "metrics":   metrics,
            "top_features": [f.get("name") for f in fi[:5]],
            "anomaly_count": anomalies.get("total", 0) if anomalies else 0,
            "insights":  insights[:3],
        }

        prompt = (
            f"You are a senior data analyst writing for a {audience} audience.\n"
            f"Based on this analysis context:\n{context}\n\n"
            f"Write a concise (3-5 paragraph) intelligence report. "
            f"{'Include 2-3 specific, actionable recommendations.' if include_recs else ''}\n"
            f"Be specific with numbers. No fluff."
        )

        try:
            if os.getenv("GOOGLE_API_KEY"):
                import google.generativeai as genai
                genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
                model = genai.GenerativeModel("gemini-1.5-flash")
                resp = model.generate_content(prompt)
                return resp.text
        except Exception as exc:
            logger.debug("llm synthesis failed: %s", exc)

        return None

    # ── Template fallback ─────────────────────────────────────────────────────

    def _template_synthesis(
        self, ml_result: Dict, anomalies: Dict,
        insights: list, metrics: Dict, fi: list,
        audience: str, include_recs: bool,
    ) -> str:
        parts = []
        family = ml_result.get("family", "analysis")
        table  = ml_result.get("table", "the dataset")
        algo   = ml_result.get("algo", "model")

        parts.append(f"**Analysis of '{table}' using {algo.upper()}**\n")

        if insights:
            parts.extend(insights[:4])

        if anomalies and anomalies.get("total", 0) > 0:
            n_crit = anomalies.get("critical", 0)
            n_warn = anomalies.get("warning", 0)
            parts.append(
                f"\n**Anomaly Detection:** {anomalies['total']} anomalies detected "
                f"({n_crit} critical, {n_warn} warning). "
                "Review flagged rows for data quality or operational issues."
            )

        if fi:
            top_names = [f.get("name", "?") for f in fi[:3]]
            parts.append(f"\n**Key Drivers:** {', '.join(top_names)}")

        if include_recs and metrics:
            parts.append(_generate_recs_text(family, metrics))

        return "\n".join(parts)


def _extract_key_findings(ml_result: Dict, anomalies: Dict, fi: list, metrics: Dict) -> list:
    findings = []
    family = ml_result.get("family", "")

    if family == "classification":
        findings.append({"type": "accuracy", "value": f"F1: {metrics.get('f1', 0):.4f}", "severity": "info"})
    elif family == "regression":
        findings.append({"type": "r2", "value": f"R²: {metrics.get('R2', 0):.4f}", "severity": "info"})
    elif family == "clustering":
        findings.append({"type": "clusters", "value": f"{metrics.get('n_clusters', 0)} segments", "severity": "info"})

    if fi:
        findings.append({"type": "top_feature", "value": fi[0].get("name", ""), "severity": "info"})

    if anomalies and anomalies.get("critical", 0) > 0:
        findings.append({"type": "anomaly", "value": f"{anomalies['critical']} critical anomalies", "severity": "critical"})
    elif anomalies and anomalies.get("total", 0) > 0:
        findings.append({"type": "anomaly", "value": f"{anomalies['total']} anomalies", "severity": "warning"})

    return findings


def _generate_recommendations(ml_result: Dict, anomalies: Dict, metrics: Dict) -> list:
    recs = []
    family = ml_result.get("family", "")

    if family == "classification" and metrics.get("f1", 0) < 0.7:
        recs.append({"action": "Collect more labelled training data", "priority": "high"})
    if family == "regression" and metrics.get("R2", 0) < 0.5:
        recs.append({"action": "Engineer interaction features or try GradientBoosting", "priority": "medium"})
    if anomalies and anomalies.get("critical", 0) > 0:
        recs.append({"action": "Investigate critical anomaly rows immediately", "priority": "critical"})
    if not recs:
        recs.append({"action": "Schedule periodic re-run to monitor for drift", "priority": "low"})

    return recs


def _generate_recs_text(family: str, metrics: Dict) -> str:
    if family == "classification":
        f1 = metrics.get("f1", 0)
        if f1 >= 0.85:
            return "\n**Recommendation:** Deploy model to production scoring pipeline."
        return "\n**Recommendation:** Collect more labelled examples and retrain."
    if family == "regression":
        r2 = metrics.get("R2", 0)
        if r2 >= 0.75:
            return "\n**Recommendation:** Use for production forecasting with weekly retraining."
        return "\n**Recommendation:** Feature engineering or ensemble methods may improve R²."
    return "\n**Recommendation:** Review findings with domain experts before acting."
