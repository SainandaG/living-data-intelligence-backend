"""
Experiment Tracker  lightweight MLflow-compatible run store.

Persists every ML run to a local JSON log (experiments.jsonl) so results
survive restarts without requiring a full MLflow server.  When MLflow is
available in the environment it is used as a secondary sink automatically.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

EXPERIMENTS_DIR = Path(os.getenv("EXPERIMENTS_DIR", "data/experiments"))
_MAX_LOG_BYTES = int(os.getenv("EXPERIMENTS_MAX_MB", "10")) * 1024 * 1024  # default 10 MB


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
        self._lock = threading.Lock()          # serialises concurrent writes (H3)
        self._mlflow_available = self._probe_mlflow()
        self._validate_dir_writable()
        # Hot-path cache: run_id  latest run dict (O(1) lookup; JSONL is the durable store)
        self._run_cache: Dict[str, Dict[str, Any]] = {}
        self._models_dir = EXPERIMENTS_DIR / "models"
        self._models_dir.mkdir(parents=True, exist_ok=True)

    def _validate_dir_writable(self) -> None:
        """T5-1: Warn at startup if the experiments directory is not writable."""
        try:
            test = EXPERIMENTS_DIR / ".write_test"
            test.write_text("ok")
            test.unlink()
        except Exception as exc:
            logger.warning(
                "experiment_tracker: experiments directory '%s' is not writable: %s. "
                "Run history will not be persisted.",
                EXPERIMENTS_DIR,
                exc,
            )

    #  Public API 

    async def start_run(
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
        await asyncio.to_thread(self._write_locked, run)
        logger.debug("run_start run_id=%s algo=%s", run.run_id, algo)
        return run

    async def finish_run(
        self,
        run: MLRun,
        metrics: Dict[str, Any],
        feature_importances: List[Dict] | None = None,
        status: str = "success",
        artifacts_path: str | None = None,
    ) -> MLRun:
        run.metrics             = metrics
        run.feature_importances = feature_importances or []
        run.status              = status
        run.artifacts_path      = artifacts_path or run.artifacts_path
        run.finished_at         = time.time()
        run.duration_s          = round(run.finished_at - run.created_at, 3)
        await asyncio.to_thread(self._write_locked, run)

        if self._mlflow_available:
            self._log_to_mlflow(run)

        # Persistence: Save snapshot to Database for Enterprise Lineage
        if run.status == "success" and run.connection_id and run.connection_id != "csv":
            try:
                from app.services.db_connector import db_connector
                sql = """
                INSERT INTO evolution.neural_snapshots (run_id, table_name, family, algo, metrics, artifact_path, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """
                # JSONB requires json.dumps
                await db_connector.execute(
                    run.connection_id, sql, 
                    run.run_id, run.table, run.family, run.algo, 
                    json.dumps(run.metrics), run.artifacts_path, run.tenant_id
                )
                logger.info("Saved neural snapshot to DB: %s", run.run_id)
            except Exception as e:
                # Non-critical: database snapshot failure shouldn't crash the ML job
                logger.warning("Database neural snapshot failed (non-critical): %s", e)

        logger.debug("run_finish run_id=%s status=%s", run.run_id, status)
        return run

    def save_artifact(self, run_id: str, model_any: Any, extension: str = "pt", is_temp: bool = False) -> str:
        """
        Thread-safe persistence of a model object.
        Supports torch (.pt) and tensorflow/keras (.keras).
        If is_temp is True, prefixes with temp_ for 1hr cleanup.
        """
        prefix = "temp_" if is_temp else ""
        filename = f"{prefix}{run_id}.{extension}"
        target_path = self._models_dir / filename
        
        try:
            if extension == "pt":
                import torch
                torch.save(model_any, target_path)
            elif extension in ["keras", "h5"]:
                # TensorFlow might be installed as tensorflow-cpu
                import tensorflow as tf
                tf.keras.models.save_model(model_any, target_path)
            else:
                import pickle
                with open(target_path, "wb") as f:
                    pickle.dump(model_any, f)
                    
            logger.info("Saved model artifact: %s", target_path)
            return str(target_path)
        except Exception as exc:
            logger.error("Failed to save model artifact %s (ext=%s): %s", run_id, extension, exc)
            return ""

    def get_artifact_path(self, run_id: str, extension: str = "pt") -> Optional[Path]:
        """Verify if an artifact exists and return its path."""
        # Try permanent version first, then temp version
        path = self._models_dir / f"{run_id}.{extension}"
        if path.exists():
            return path
        
        path_temp = self._models_dir / f"temp_{run_id}.{extension}"
        if path_temp.exists():
            return path_temp
            
        return None

    def get_runs(
        self,
        experiment: str | None = None,
        tenant_id: str = "default",
        limit: int = 50,
    ) -> List[Dict]:
        # Deduplicate by run_id, keeping the latest entry for each run
        run_map = {}
        if not self._log_path.exists():
            return []
            
        with self._lock:
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
                        
                    rid = rec.get("run_id")
                    if rid:
                        # Overwrite with later entries (e.g. success/failed replaces running)
                        run_map[rid] = rec
        
        runs = list(run_map.values())
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

    #  Internals 

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """O(1) lookup by run_id from the in-memory cache."""
        return self._run_cache.get(run_id)

    def _write_locked(self, run: MLRun) -> None:
        """Thread-safe append with log rotation (H1, H2, H3)."""
        run_dict = asdict(run)
        with self._lock:
            # Update hot-path cache before touching disk
            self._run_cache[run.run_id] = run_dict
            try:
                # Rotate when file exceeds _MAX_LOG_BYTES
                if self._log_path.exists() and self._log_path.stat().st_size >= _MAX_LOG_BYTES:
                    bak = self._log_path.with_suffix(".jsonl.bak")
                    bak.unlink(missing_ok=True)
                    self._log_path.rename(bak)
                    logger.info("experiment_tracker: rotated runs.jsonl  runs.jsonl.bak")
                with open(self._log_path, "a", encoding="utf-8") as fh:
                    fh.write(json.dumps(run_dict) + "\n")
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
