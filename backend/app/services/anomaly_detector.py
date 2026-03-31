"""
Anomaly Detection with Ensemble Methods
Detects anomalies using Z-score, Modified Z-score, IQR, and Isolation Forest.
An anomaly is flagged only when at least 2 of the 4 methods agree (ensemble voting).
States are persisted to ensure historical context survives restarts.
"""
from typing import Dict, List, Any, Optional
import statistics
import json
import asyncio
import logging
from datetime import datetime

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Per-metric detection methods
# ---------------------------------------------------------------------------

def _zscore(value: float, history: List[float], threshold: float = 3.0) -> Optional[Dict]:
    mean = statistics.mean(history)
    stdev = statistics.stdev(history) if len(history) > 1 else 0.1
    stdev = max(stdev, 0.1)
    z = abs((value - mean) / stdev)
    if z > threshold:
        return {"method": "zscore", "score": round(z, 3), "mean": mean, "stdev": stdev}
    return None


def _modified_zscore(value: float, history: List[float], threshold: float = 3.5) -> Optional[Dict]:
    """Hampel identifier — more robust than mean-based Z-score."""
    median = statistics.median(history)
    mad = statistics.median([abs(v - median) for v in history])
    mad = max(mad, 1e-6)
    mz = abs(0.6745 * (value - median) / mad)
    if mz > threshold:
        return {"method": "modified_zscore", "score": round(mz, 3), "median": median, "mad": mad}
    return None


def _iqr(value: float, history: List[float], multiplier: float = 1.5) -> Optional[Dict]:
    """Interquartile Range outlier test."""
    arr = sorted(history)
    n = len(arr)
    q1 = arr[n // 4]
    q3 = arr[3 * n // 4]
    iqr_val = q3 - q1
    lower = q1 - multiplier * iqr_val
    upper = q3 + multiplier * iqr_val
    if value < lower or value > upper:
        return {"method": "iqr", "score": round(abs(value - (q1 + q3) / 2) / max(iqr_val, 1e-6), 3),
                "lower": lower, "upper": upper, "q1": q1, "q3": q3}
    return None


def _isolation_forest(value: float, history: List[float]) -> Optional[Dict]:
    """
    Lightweight Isolation Forest approximation using sklearn when available,
    falling back gracefully if not installed.
    """
    if len(history) < 10:
        return None
    try:
        from sklearn.ensemble import IsolationForest
        X = np.array(history + [value]).reshape(-1, 1)
        clf = IsolationForest(contamination=0.05, random_state=42, n_estimators=50)
        clf.fit(X[:-1])
        pred = clf.predict([[value]])[0]
        score = float(-clf.score_samples([[value]])[0])  # Higher = more anomalous
        if pred == -1:
            return {"method": "isolation_forest", "score": round(score, 4)}
    except ImportError:
        pass
    except Exception as e:
        logger.debug(f"IsolationForest failed: {e}")
    return None


def _ensemble_detect(
    metric: str,
    value: float,
    history: List[float],
    z_threshold: float = 3.0,
    votes_required: int = 2,
) -> Optional[Dict[str, Any]]:
    """
    Run all four methods and flag an anomaly only if votes_required methods agree.
    Returns None if not an anomaly, else a full anomaly dict.
    """
    signals = [
        _zscore(value, history, z_threshold),
        _modified_zscore(value, history),
        _iqr(value, history),
        _isolation_forest(value, history),
    ]
    hits = [s for s in signals if s is not None]

    if len(hits) < votes_required:
        return None

    # Severity: High if 3+ methods agree or any z-score > 5
    z_hit = next((h for h in hits if h['method'] == 'zscore'), None)
    high = len(hits) >= 3 or (z_hit and z_hit['score'] > 5)
    severity = "High" if high else "Medium"

    mean = statistics.mean(history)
    primary_score = hits[0]['score']

    return {
        "metric": metric,
        "current_value": value,
        "expected_value": round(mean, 3),
        "z_score": z_hit['score'] if z_hit else primary_score,
        "severity": severity,
        "votes": len(hits),
        "methods_triggered": [h['method'] for h in hits],
        "description": (
            f"{metric.replace('_', ' ').title()} is {value:.1f} "
            f"(expected ~{mean:.1f}, {len(hits)}/4 methods flagged)"
        ),
        "explanation": (
            f"{metric.replace('_', ' ').title()} anomalous variance detected by "
            + ", ".join(h['method'] for h in hits)
        ),
    }


class AnomalyDetector:
    """
    Ensemble Anomaly Detection with Persistent Memory.
    Methods: Z-score, Modified Z-score (Hampel), IQR, Isolation Forest.
    Flags anomaly only when ≥2 methods agree.
    """

    def __init__(self):
        self.baseline_metrics: Dict[str, Dict[str, List[float]]] = {}
        self.anomaly_history: Dict[str, List[Dict]] = {}
        self.thresholds = {
            "z_score": 3.0,
            "noise_floor": 0.1,
            "votes_required": 2,
        }

    async def hydrate_memory(self, db_connector, connection_id: str):
        """Restore statistical baselines from the database."""
        try:
            sql = "SELECT metrics_json FROM evolution.statistical_memory WHERE connection_id = %s"
            res = await db_connector.query(connection_id, sql, (connection_id,))
            if res:
                self.baseline_metrics[connection_id] = json.loads(res[0]['metrics_json'])
                logger.info(f"AnomalyDetector: Hydrated memory for {connection_id}")
        except Exception as e:
            logger.debug(f"Could not hydrate baseline for {connection_id}: {e}")
            self.baseline_metrics[connection_id] = {}

    async def detect_anomalies(
        self, connection_id: str, current_metrics: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Detect anomalies using ensemble methods.
        Updates persistent memory on every tick.
        """
        anomalies = []
        if connection_id not in self.baseline_metrics:
            self.baseline_metrics[connection_id] = {}

        baseline = self.baseline_metrics[connection_id]

        for metric, value in current_metrics.items():
            if not isinstance(value, (int, float)):
                continue

            if metric not in baseline:
                baseline[metric] = []
            baseline[metric].append(value)

            # Rolling window of 200 points
            if len(baseline[metric]) > 200:
                baseline[metric].pop(0)

            if len(baseline[metric]) > 5:
                anomaly = _ensemble_detect(
                    metric,
                    value,
                    baseline[metric],
                    z_threshold=self.thresholds["z_score"],
                    votes_required=self.thresholds["votes_required"],
                )
                if anomaly:
                    anomalies.append(anomaly)

        asyncio.create_task(self._persist_memory(connection_id))
        return anomalies

    async def _persist_memory(self, connection_id: str):
        """Save statistical baselines to database."""
        from app.services.db_connector import db_connector
        try:
            conn_info = db_connector.get_connection(connection_id)
            db_type = conn_info.get('type', 'mysql').lower()

            if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                await db_connector.query(connection_id, "CREATE SCHEMA IF NOT EXISTS evolution")
                await db_connector.query(connection_id, """
                    CREATE TABLE IF NOT EXISTS evolution.statistical_memory (
                        connection_id VARCHAR(255) PRIMARY KEY,
                        metrics_json JSONB,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """)
            else:
                await db_connector.query(connection_id, """
                    CREATE TABLE IF NOT EXISTS statistical_memory (
                        connection_id VARCHAR(255) PRIMARY KEY,
                        metrics_json JSON,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

            data = json.dumps(self.baseline_metrics.get(connection_id, {}))

            if db_type in ['postgresql', 'postgres', 'neon', 'neon_db']:
                sql = """
                    INSERT INTO evolution.statistical_memory (connection_id, metrics_json, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (connection_id) DO UPDATE SET
                        metrics_json = EXCLUDED.metrics_json,
                        updated_at = NOW()
                """
            else:
                sql = """
                    INSERT INTO statistical_memory (connection_id, metrics_json, updated_at)
                    VALUES (%s, %s, NOW())
                    ON DUPLICATE KEY UPDATE metrics_json = VALUES(metrics_json), updated_at = NOW()
                """

            await db_connector.query(connection_id, sql, (connection_id, data))
        except Exception as e:
            logger.error(f"AnomalyDetector: Memory persistence fail: {e}")

    def detect_cascading_failures(
        self, connection_id: str, current_anomalies: List[Dict]
    ) -> List[Dict]:
        """
        Identify potential cascading failures by correlating high-severity anomalies
        with tables that have high out-degree in the graph topology.
        """
        if not current_anomalies:
            return []

        try:
            from app.services.neural_core import neural_core
            out_degrees: Dict[str, int] = neural_core.out_degrees.get(connection_id, {})
        except Exception as e:
            logger.debug("Could not access neural_core out_degrees for cascade analysis: %s", e)
            out_degrees = {}

        high_anomalies = [a for a in current_anomalies if a.get("severity") == "High"]
        if not high_anomalies:
            return []

        high_impact_tables = [t for t, d in out_degrees.items() if d >= 3]

        cascades: List[Dict] = []
        for anomaly in high_anomalies:
            metric = anomaly.get("metric", "unknown")
            affected = high_impact_tables[:5]
            if not affected:
                continue
            cascades.append({
                "trigger_metric": metric,
                "trigger_anomaly": anomaly,
                "potentially_affected_tables": affected,
                "severity": "High",
                "description": (
                    f"Anomaly in '{metric}' may propagate through "
                    f"{len(high_impact_tables)} highly-connected table(s): "
                    + ", ".join(affected)
                    + "."
                ),
            })

        return cascades

    def get_affected_nodes(self, anomaly: Dict[str, Any], graph_nodes: List[Dict]) -> List[str]:
        affected = []
        metric = anomaly['metric']
        entities = {'transaction_rate': ['transaction'], 'fraud_alerts': ['fraud']}
        relevant = entities.get(metric, ['transaction'])
        for node in graph_nodes:
            if node.get('entity') in relevant:
                node_id = node.get('id', node.get('name', 'unknown'))
                affected.append(node_id)
        return affected

    def generate_visual_overlay_data(
        self, anomaly: Dict[str, Any], affected_nodes: List[str]
    ) -> Dict[str, Any]:
        return {
            "anomaly_id": f"anomaly_{datetime.now().timestamp()}",
            "type": anomaly['severity'],
            "affected_nodes": affected_nodes,
            "highlight_color": '#ff4757' if anomaly['severity'] == 'High' else '#ffd60a',
            "explanation": anomaly['explanation'],
        }


# Global instance
anomaly_detector = AnomalyDetector()
