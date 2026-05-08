"""
Traffic Service — Universal Real-Time Traffic Scoring System
Location: backend/app/services/traffic_service.py

Computes a normalized traffic_score (0-100) for each table/node.
Designed as an ADDITIVE service — never modifies existing logic.
Feature-flagged: set ENABLE_TRAFFIC_SCORING=True to activate.
"""

import logging
import math
import time
import os
from typing import Dict, Any, List, Optional
from collections import deque
from datetime import datetime

logger = logging.getLogger(__name__)

# ─── Feature Flag ───────────────────────────────────────────────────────────
ENABLE_TRAFFIC_SCORING: bool = os.getenv("ENABLE_TRAFFIC_SCORING", "true").lower() == "true"

# ─── Normalization Caps (safe upper bounds for each metric) ──────────────────
_CAPS = {
    "ops_per_sec":         5000.0,   # ops/s → 1.0 at 5000
    "avg_latency":          500.0,   # ms   → 1.0 at 500 ms (higher = worse)
    "error_rate":             1.0,   # 0–1  → already normalized
    "active_connections":   200.0,   # conn → 1.0 at 200
    "write_rate":          2000.0,   # rows/s
    "row_count":        10_000_000,  # rows  → 1.0 at 10 M
}

# ─── Score thresholds → level labels ────────────────────────────────────────
_LEVELS = [
    (80, "critical"),
    (60, "high"),
    (30, "moderate"),
    (0,  "low"),
]

# ─── Default safe response ───────────────────────────────────────────────────
DEFAULT_TRAFFIC = {"score": 0.0, "level": "low"}

# ─── In-memory history store (per connection/table) ──────────────────────────
# Key: (connection_id, table_name)  Value: deque of {"ts": float, "score": float}
_history: Dict[tuple, deque] = {}
_HISTORY_MAX = 60          # keep last 60 data-points (≈ 10 min @ 10 s ticks)
_HISTORY_WINDOW_S = 600    # 10 minutes


def _normalize(value: float, cap: float, invert: bool = False) -> float:
    """Clamp value to [0, cap] then scale to [0, 1]. Optionally invert."""
    if cap <= 0:
        return 0.0
    norm = max(0.0, min(float(value), cap)) / cap
    return (1.0 - norm) if invert else norm


def compute_traffic_score(metrics: dict) -> dict:
    """
    Compute a traffic score from raw DB metrics.

    Parameters
    ----------
    metrics : dict
        Keys: ops_per_sec, avg_latency, error_rate,
              active_connections, write_rate, row_count

    Returns
    -------
    dict  {"score": float, "level": str}
    """
    if not ENABLE_TRAFFIC_SCORING:
        return DEFAULT_TRAFFIC

    try:
        # ── Safe extraction with defaults ────────────────────────────────
        ops     = float(metrics.get("ops_per_sec",        0) or 0)
        lat     = float(metrics.get("avg_latency",        0) or 0)
        err     = float(metrics.get("error_rate",         0) or 0)
        conns   = float(metrics.get("active_connections", 0) or 0)
        writes  = float(metrics.get("write_rate",         0) or 0)
        rows    = float(metrics.get("row_count",          0) or 0)

        # ── Normalise (latency & error_rate contribute more when higher) ─
        norm_ops         = _normalize(ops,    _CAPS["ops_per_sec"])
        norm_latency     = _normalize(lat,    _CAPS["avg_latency"])       # high lat → high score
        norm_error       = _normalize(err,    _CAPS["error_rate"])        # high err → high score
        norm_concurrency = _normalize(conns,  _CAPS["active_connections"])
        norm_write       = _normalize(writes, _CAPS["write_rate"])
        norm_size        = _normalize(rows,   _CAPS["row_count"])

        # ── Weighted composite ───────────────────────────────────────────
        raw_score = (
            0.30 * norm_ops         +
            0.20 * norm_latency     +
            0.15 * norm_error       +
            0.15 * norm_concurrency +
            0.10 * norm_write       +
            0.10 * norm_size
        ) * 100

        score = round(min(100.0, max(0.0, raw_score)), 2)

        # ── Level label ──────────────────────────────────────────────────
        level = "low"
        for threshold, label in _LEVELS:
            if score > threshold:
                level = label
                break

        return {"score": score, "level": level}

    except Exception as exc:
        logger.error("[TrafficService] compute_traffic_score failed: %s", exc, exc_info=True)
        return DEFAULT_TRAFFIC


def enrich_metrics_with_traffic(metrics: dict) -> dict:
    """
    Attach a 'traffic' key to an existing metrics dict.
    Non-destructive — adds only, never overwrites.

    Usage (inside realtime_monitor, after metrics collection):
        metrics = enrich_metrics_with_traffic(metrics)
    """
    if not ENABLE_TRAFFIC_SCORING:
        metrics.setdefault("traffic", DEFAULT_TRAFFIC)
        return metrics

    try:
        traffic_input = {
            "ops_per_sec":        metrics.get("transaction_rate",      0),
            "avg_latency":        metrics.get("avg_query_time_ms",     0),
            "error_rate":         metrics.get("error_rate",            0),
            "active_connections": metrics.get("active_connections",    0),
            "write_rate":         metrics.get("write_tps",             0),
            "row_count":          metrics.get("total_rows",            0),
        }
        metrics["traffic"] = compute_traffic_score(traffic_input)
    except Exception as exc:
        logger.error("[TrafficService] enrich_metrics_with_traffic failed: %s", exc)
        metrics.setdefault("traffic", DEFAULT_TRAFFIC)

    return metrics


# ─── Per-Table Traffic (node-level) ─────────────────────────────────────────

def compute_node_traffic(node_metrics: dict) -> dict:
    """
    Compute traffic for a single table node.
    node_metrics keys mirror _get_node_specific_metrics() output.
    """
    if not ENABLE_TRAFFIC_SCORING:
        return DEFAULT_TRAFFIC

    try:
        mapped = {
            "ops_per_sec":        node_metrics.get("reads_per_sec", 0) + node_metrics.get("writes_per_sec", 0),
            "avg_latency":        node_metrics.get("avg_query_time_ms", 0),
            "error_rate":         node_metrics.get("error_rate", 0),
            "active_connections": node_metrics.get("active_connections", 0),
            "write_rate":         node_metrics.get("writes_per_sec", 0),
            "row_count":          node_metrics.get("row_count", 0),
        }
        return compute_traffic_score(mapped)
    except Exception as exc:
        logger.error("[TrafficService] compute_node_traffic failed: %s", exc)
        return DEFAULT_TRAFFIC


# ─── History tracking ────────────────────────────────────────────────────────

def record_traffic_history(connection_id: str, table_name: str, score: float) -> None:
    """Append a score data-point to the in-memory rolling history."""
    if not ENABLE_TRAFFIC_SCORING:
        return
    try:
        key = (connection_id, table_name)
        if key not in _history:
            _history[key] = deque(maxlen=_HISTORY_MAX)
        _history[key].append({"ts": time.time(), "score": score})
    except Exception as exc:
        logger.error("[TrafficService] record_traffic_history failed: %s", exc)


def get_traffic_history(connection_id: str, table_name: str) -> List[dict]:
    """
    Return recent history list: [{"ts": float, "score": float}, ...]
    Entries older than _HISTORY_WINDOW_S are pruned on read.
    """
    try:
        key = (connection_id, table_name)
        if key not in _history:
            return []
        cutoff = time.time() - _HISTORY_WINDOW_S
        return [p for p in _history[key] if p["ts"] >= cutoff]
    except Exception as exc:
        logger.error("[TrafficService] get_traffic_history failed: %s", exc)
        return []


# ─── Aggregate snapshot (all tables for a connection) ───────────────────────

def get_all_traffic_scores(connection_id: str) -> List[dict]:
    """
    Return latest traffic score for every tracked table of a connection.
    [{"table": str, "score": float, "level": str}, ...]
    """
    try:
        results = []
        for (cid, table), dq in _history.items():
            if cid != connection_id or not dq:
                continue
            latest = dq[-1]["score"]
            level = "low"
            for threshold, label in _LEVELS:
                if latest > threshold:
                    level = label
                    break
            results.append({"table": table, "score": latest, "level": level})
        return sorted(results, key=lambda x: x["score"], reverse=True)
    except Exception as exc:
        logger.error("[TrafficService] get_all_traffic_scores failed: %s", exc)
        return []


# ─── Distribution summary ────────────────────────────────────────────────────

def get_traffic_distribution(connection_id: str) -> dict:
    """
    Returns count of tables per traffic level:
    {"critical": int, "high": int, "moderate": int, "low": int, "total": int}
    """
    try:
        all_scores = get_all_traffic_scores(connection_id)
        dist = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
        for item in all_scores:
            dist[item["level"]] += 1
        dist["total"] = sum(dist.values())
        return dist
    except Exception as exc:
        logger.error("[TrafficService] get_traffic_distribution failed: %s", exc)
        return {"critical": 0, "high": 0, "moderate": 0, "low": 0, "total": 0}


# ─── AI Recommendations ──────────────────────────────────────────────────────

_RECOMMENDATIONS = {
    "critical": [
        "Add composite index on high-frequency query columns",
        "Optimize slow queries (review EXPLAIN output)",
        "Consider read replicas or connection pooling",
        "Enable query result caching for read-heavy patterns",
        "Partition large tables by date or key range",
    ],
    "high": [
        "Review and optimize N+1 query patterns",
        "Add missing indexes on foreign key columns",
        "Monitor and tune autovacuum settings",
        "Consider caching layer for repeated queries",
    ],
    "moderate": [
        "Schedule ANALYZE during off-peak hours",
        "Review index usage statistics",
        "Consider archiving old data",
    ],
    "low": [
        "Table is operating within normal parameters",
        "Continue monitoring for trend changes",
    ],
}

_ROOT_CAUSES = {
    "critical": "High insert rate and slow queries causing backlog in query processing.",
    "high":     "Elevated read/write concurrency with suboptimal index coverage.",
    "moderate": "Moderate load with occasional query spikes detected.",
    "low":      "Table traffic is within acceptable baseline thresholds.",
}


def get_ai_recommendations(table: str, traffic: dict) -> dict:
    """Generate AI-style recommendations based on traffic level."""
    try:
        level = traffic.get("level", "low")
        score = traffic.get("score", 0)
        return {
            "table": table,
            "level": level,
            "score": score,
            "root_cause": _ROOT_CAUSES.get(level, ""),
            "recommendations": _RECOMMENDATIONS.get(level, []),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        logger.error("[TrafficService] get_ai_recommendations failed: %s", exc)
        return {"table": table, "level": "low", "score": 0, "root_cause": "", "recommendations": []}
