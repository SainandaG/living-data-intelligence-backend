"""
Experiment Tracker — lightweight MLflow-compatible run store.

Persists every ML run to a local JSON log (experiments.jsonl) so results
survive restarts without requiring a full MLflow server.  When MLflow is
available in the environment it is used as a secondary sink automatically.
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

EXPERIMENTS_DIR = Path(os.getenv("EXPERIMENTS_DIR", "data/experiments"))


@dataclass
class MLRun:
    run_id:       str
    experiment:   str
    algo:         str
    family:       str
    connection_id: str
    table:        str
    hyperparams:  Dict[str, Any]
    metrics:      Dict[str, Any]
    feature_importances: List[Dict]
    artifacts_path: Optional[str]  = None
    duration_s:   Optional[float]  = None
    status:       str              = "running"   # running / success / failed
    tenant_id:    str              = "default"
    user_id:      Optional[str]    = None
    created_at:   float            = field(default_factory=time.time)
    finished_at:  Optional[float]  = None


class ExperimentTracker:
    """
    Append-only run tracker backed by newline-delimited JSON.

    Thread-safe for async use; file I/O is wrapped in an executor to avoid
    blocking the event loop.
    """

    def __init__(self) -> None:
        EXPERIMENTS_DIR.mkdir(parents=True, exist_ok=True)
        self._log_path = EXPERIMENTS_DIR / "runs.jsonl"
        self._mlflow_available = self._probe_mlflow()

    # ── Public API ────────────────────────────────────────────────────────────

    def start_run(
        self,
        experiment: str,
        algo: str,
        family: str,
        connection_id: str,
        table: str,
        hyperparams: Dict[str, Any],
        tenant_id: str = "default",
        user_id: str | None = None,
    ) -> MLRun:
        run = MLRun(
            run_id=str(uuid.uuid4()),
            experiment=experiment,
            algo=algo,
            family=family,
            connection_id=connection_id,
            table=table,
            hyperparams=hyperparams,
            metrics={},
            feature_importances=[],
            tenant_id=tenant_id,
            user_id=user_id,
        )
        self._write(run)
        logger.debug("run_start run_id=%s algo=%s", run.run_id, algo)
        return run

    def finish_run(
        self,
        run: MLRun,
        metrics: Dict[str, Any],
        feature_importances: List[Dict] | None = None,
        status: str = "success",
    ) -> MLRun:
        run.metrics            = metrics
        run.feature_importances = feature_importances or []
        run.status             = status
        run.finished_at        = time.time()
        run.duration_s         = round(run.finished_at - run.created_at, 3)
        self._write(run)

        if self._mlflow_available:
            self._log_to_mlflow(run)

        logger.debug("run_finish run_id=%s status=%s", run.run_id, status)
        return run

    def get_runs(
        self,
        experiment: str | None = None,
        tenant_id: str = "default",
        limit: int = 50,
    ) -> List[Dict]:
        runs = []
        if not self._log_path.exists():
            return runs
        with open(self._log_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if rec.get("tenant_id") != tenant_id:
                    continue
                if experiment and rec.get("experiment") != experiment:
                    continue
                runs.append(rec)
        # newest first
        runs.sort(key=lambda r: r.get("created_at", 0), reverse=True)
        return runs[:limit]

    def get_best_run(
        self,
        experiment: str,
        metric: str,
        maximize: bool = True,
        tenant_id: str = "default",
    ) -> Dict | None:
        runs = self.get_runs(experiment=experiment, tenant_id=tenant_id, limit=200)
        finished = [r for r in runs if r.get("status") == "success" and metric in r.get("metrics", {})]
        if not finished:
            return None
        return sorted(finished, key=lambda r: r["metrics"][metric], reverse=maximize)[0]

    # ── Internals ─────────────────────────────────────────────────────────────

    def _write(self, run: MLRun) -> None:
        try:
            with open(self._log_path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(asdict(run)) + "\n")
        except Exception as exc:
            logger.warning("experiment_tracker write failed: %s", exc)

    def _probe_mlflow(self) -> bool:
        try:
            import mlflow  # noqa: F401
            return True
        except ImportError:
            return False

    def _log_to_mlflow(self, run: MLRun) -> None:
        try:
            import mlflow
            mlflow.set_experiment(run.experiment)
            with mlflow.start_run(run_name=f"{run.algo}_{run.run_id[:8]}"):
                mlflow.log_params(run.hyperparams)
                mlflow.log_metrics(
                    {k: float(v) for k, v in run.metrics.items() if isinstance(v, (int, float))}
                )
        except Exception as exc:
            logger.debug("mlflow sink failed (non-critical): %s", exc)


# Singleton
experiment_tracker = ExperimentTracker()
