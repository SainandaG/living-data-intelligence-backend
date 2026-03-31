"""
ML Runner Tool — runs a single ML experiment or full AutoML search.
Delegates to the ml_analysis pipeline and experiment_tracker.
"""
from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Dict

logger = logging.getLogger(__name__)


class MLRunnerTool:
    def __init__(self, automl: bool = False) -> None:
        self.automl = automl
        self.name = "run_automl" if automl else "run_ml"

    async def execute(
        self, params: Dict[str, Any], memory: Any, connection_id: str
    ) -> AsyncGenerator[Dict, None]:
        table   = params.get("table")   or memory.get("primary_table")
        family  = params.get("family")  or "classification"
        algo    = params.get("algo",  "auto")
        target  = params.get("target") or memory.get("suggested_target")
        features: list = params.get("features") or memory.get("feature_cols") or []

        if not table:
            yield {"type": "error", "text": "No table resolved for ML. Run sample_data first."}
            return

        # Auto-select family from memory when caller says "auto"
        if family == "auto":
            profile = memory.get("column_profile", {})
            date_cols = profile.get("date_cols", [])
            numeric_cols = profile.get("numeric_cols", [])
            if date_cols and numeric_cols:
                family = "timeseries"
                target = target or numeric_cols[0]
            elif numeric_cols:
                family = "regression"
                target = target or numeric_cols[0]
            else:
                family = "clustering"

        verb = "AutoML" if self.automl else "ML"
        yield {"type": "status", "text": f"Running {verb} ({family}) on '{table}'..."}

        try:
            import asyncio
            from app.api.ml_analysis import (
                AnalysisRequest, _fetch_data, _preprocess,
                _run_classification, _run_regression, _run_clustering,
                _run_timeseries, _build_insights, AnalysisResult,
            )

            all_cols = list(dict.fromkeys(([target] if target else []) + features))
            rows = await _fetch_data(connection_id, table, all_cols, n=2000)

            if not rows:
                yield {"type": "error", "text": f"No data from '{table}'."}
                return

            loop = asyncio.get_running_loop()

            if family == "timeseries":
                metrics, fi, predictions = await loop.run_in_executor(
                    None, _run_timeseries, rows, features, target, algo if algo != "auto" else "arima"
                )
            else:
                X, y, feature_names = await loop.run_in_executor(
                    None, _preprocess, rows, features, target, family
                )
                if X is None or len(X) == 0:
                    yield {"type": "error", "text": "Preprocessing produced no usable data."}
                    return

                if self.automl:
                    # Try top-2 algos and pick best
                    from app.services.ml.automl.selector import algorithm_selector
                    candidates = algorithm_selector.rank(family=family, n_rows=len(X), n_features=X.shape[1])[:2]
                    best_metrics, best_fi, best_preds, best_algo_id = None, None, None, algo
                    best_score = -999.0

                    for cand in candidates:
                        try:
                            if family == "classification":
                                m, f, p = await loop.run_in_executor(None, _run_classification, X, y, cand.algo_id, feature_names)
                            elif family == "regression":
                                m, f, p = await loop.run_in_executor(None, _run_regression, X, y, cand.algo_id, feature_names)
                            else:
                                m, f, p = await loop.run_in_executor(None, _run_clustering, X, cand.algo_id, feature_names)
                            score = m.get("f1", m.get("R2", m.get("silhouette_score", 0.0)))
                            if score > best_score:
                                best_score, best_metrics, best_fi, best_preds, best_algo_id = score, m, f, p, cand.algo_id
                        except Exception as e:
                            logger.debug("automl candidate %s failed: %s", cand.algo_id, e)

                    metrics, fi, predictions, algo = best_metrics or {}, best_fi or [], best_preds or [], best_algo_id
                else:
                    resolved_algo = algo if algo != "auto" else _default_algo(family)
                    if family == "classification":
                        metrics, fi, predictions = await loop.run_in_executor(None, _run_classification, X, y, resolved_algo, feature_names)
                    elif family == "regression":
                        metrics, fi, predictions = await loop.run_in_executor(None, _run_regression, X, y, resolved_algo, feature_names)
                    else:
                        metrics, fi, predictions = await loop.run_in_executor(None, _run_clustering, X, resolved_algo, feature_names)

            insights = _build_insights(family, str(algo), table, target, fi, metrics, len(rows))

            result = {
                "algo":               str(algo),
                "family":             family,
                "table":              table,
                "metrics":            metrics,
                "feature_importances": [f.dict() if hasattr(f, "dict") else vars(f) for f in fi],
                "insights":           insights,
            }

            memory.set("ml_result", result, source=self.name)
            memory.set("ml_metrics", metrics, source=self.name)
            memory.set("ml_fi", result["feature_importances"], source=self.name)
            memory.set("ml_insights", insights, source=self.name)

            score_key = {"classification": "f1", "regression": "R2", "clustering": "silhouette_score", "timeseries": "MAPE"}.get(family, "f1")
            score_val = metrics.get(score_key, 0)
            yield {
                "type":    "result",
                "text":    f"{verb} complete — {algo} · {score_key}={score_val:.4f}",
                "data":    result,
                "summary": f"algo={algo} · {score_key}={score_val:.4f} · {len(rows):,} rows",
            }

        except Exception as exc:
            logger.error("ml_runner failed: %s", exc, exc_info=True)
            yield {"type": "error", "text": f"ML execution failed: {exc}"}


def _default_algo(family: str) -> str:
    return {"classification": "rf_clf", "regression": "xgboost",
            "clustering": "kmeans", "timeseries": "arima"}.get(family, "rf_clf")
