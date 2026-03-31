"""
Anomaly Detector Tool — statistical anomaly detection (Z-score + IQR).
Segments anomalies by categorical dimensions when available.
"""
from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Dict, List

import numpy as np

logger = logging.getLogger(__name__)


class AnomalyDetectorTool:
    name = "detect_anomalies"

    async def execute(
        self, params: Dict[str, Any], memory: Any, connection_id: str
    ) -> AsyncGenerator[Dict, None]:
        yield {"type": "status", "text": "Running statistical anomaly detection..."}

        rows = memory.get("sample_rows")
        if not rows:
            yield {"type": "error", "text": "No sampled data. Run sample_data first."}
            return

        try:
            import pandas as pd
            df = pd.DataFrame(rows)

            profile  = memory.get("column_profile", {})
            num_cols = profile.get("numeric_cols", [])
            num_cols = [c for c in num_cols if c in df.columns]

            if not num_cols:
                yield {"type": "error", "text": "No numeric columns found for anomaly detection."}
                return

            sensitivity = params.get("sensitivity", "medium")
            z_thresh    = {"low": 3.5, "medium": 2.5, "high": 1.8}.get(sensitivity, 2.5)

            anomalies: List[Dict] = []
            column_stats: List[Dict] = []

            for col in num_cols[:10]:
                series = pd.to_numeric(df[col], errors="coerce").dropna()
                if len(series) < 10:
                    continue

                mean = float(series.mean())
                std  = float(series.std())
                q1   = float(series.quantile(0.25))
                q3   = float(series.quantile(0.75))
                iqr  = q3 - q1

                # Z-score anomalies
                if std > 0:
                    z_scores = np.abs((series - mean) / std)
                    z_anom   = series[z_scores > z_thresh]
                    for idx, val in z_anom.items():
                        anomalies.append({
                            "column":    col,
                            "row_index": int(idx),
                            "value":     round(float(val), 4),
                            "z_score":   round(float(z_scores[idx]), 2),
                            "method":    "zscore",
                            "severity":  "critical" if z_scores[idx] > z_thresh * 1.5 else "warning",
                        })

                # IQR fence anomalies
                if iqr > 0:
                    lower_fence = q1 - 1.5 * iqr
                    upper_fence = q3 + 1.5 * iqr
                    iqr_anom    = series[(series < lower_fence) | (series > upper_fence)]
                    for idx, val in iqr_anom.items():
                        # Avoid duplicates from z-score
                        if not any(a["row_index"] == int(idx) and a["column"] == col for a in anomalies):
                            anomalies.append({
                                "column":    col,
                                "row_index": int(idx),
                                "value":     round(float(val), 4),
                                "method":    "iqr",
                                "severity":  "warning",
                            })

                column_stats.append({
                    "column": col,
                    "mean":   round(mean, 4),
                    "std":    round(std, 4),
                    "q1":     round(q1, 4),
                    "q3":     round(q3, 4),
                    "anomaly_count": sum(1 for a in anomalies if a["column"] == col),
                })

            # Sort by severity
            severity_order = {"critical": 0, "warning": 1}
            anomalies.sort(key=lambda a: severity_order.get(a.get("severity", "warning"), 1))
            anomalies = anomalies[:100]   # cap for response size

            n_critical = sum(1 for a in anomalies if a.get("severity") == "critical")
            n_warning  = sum(1 for a in anomalies if a.get("severity") == "warning")
            total      = len(anomalies)

            result = {
                "anomalies":     anomalies,
                "column_stats":  column_stats,
                "total":         total,
                "critical":      n_critical,
                "warning":       n_warning,
                "sensitivity":   sensitivity,
            }

            memory.set("anomaly_result", result, source="detect_anomalies")
            memory.set("anomaly_count", total, source="detect_anomalies")

            severity_label = "CRITICAL" if n_critical > 0 else ("WARNING" if n_warning > 0 else "CLEAN")
            yield {
                "type":    "result",
                "text":    f"Anomaly detection complete — {total} anomalies found ({n_critical} critical, {n_warning} warning).",
                "data":    result,
                "summary": f"{severity_label} · {total} anomalies across {len(column_stats)} columns",
            }

        except Exception as exc:
            logger.error("anomaly_detector_tool failed: %s", exc, exc_info=True)
            yield {"type": "error", "text": f"Anomaly detection failed: {exc}"}
