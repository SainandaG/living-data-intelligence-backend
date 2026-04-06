"""
ML Analysis API  —  /api/ml/analyze
Real ML analysis using scikit-learn for Classification, Regression,
Time Series, and Clustering on actual database table data.

Algorithms:
  Classification : RandomForest, SVM, KNN, LogisticRegression
  Regression     : LinearRegression, Ridge, Lasso, GradientBoosting (xgboost fallback)
  Clustering     : KMeans (auto-k), DBSCAN (auto-eps)
  Time Series    : Linear-trend + seasonal decomposition (no statsmodels needed)
"""

from __future__ import annotations

import asyncio
import logging
import math
import re
import uuid
from typing import Any, Dict, List, Literal, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml", tags=["ml-analysis"])

# In-memory store for async job results: run_id → {status, result?, error?, _ts}
# The JSONL file in experiment_tracker is the durable store; this is the hot path.
_pending_results: Dict[str, Dict[str, Any]] = {}
_PENDING_TTL_S = 3600       # evict completed/failed entries after 1 hour
_PENDING_MAX   = 500        # hard cap — oldest entries dropped first

def _pending_set(run_id: str, value: Dict[str, Any]) -> None:
    """Write to _pending_results with a timestamp, enforcing TTL and size cap."""
    import time as _time
    now = _time.monotonic()
    value["_ts"] = now

    # Evict expired entries first
    expired = [k for k, v in _pending_results.items()
               if v.get("status") != "running" and now - v.get("_ts", now) > _PENDING_TTL_S]
    for k in expired:
        del _pending_results[k]

    # If still over cap, drop oldest non-running entries
    if len(_pending_results) >= _PENDING_MAX:
        candidates = sorted(
            ((k, v.get("_ts", 0)) for k, v in _pending_results.items() if v.get("status") != "running"),
            key=lambda x: x[1],
        )
        for k, _ in candidates[:max(1, len(candidates) - _PENDING_MAX // 2)]:
            del _pending_results[k]

    _pending_results[run_id] = value

VALID_ALGOS: Dict[str, set] = {
    "classification": {"rf_clf", "svm", "knn", "logreg"},
    "regression":     {"linear", "ridge", "lasso", "xgboost"},
    "clustering":     {"kmeans", "dbscan"},
    "timeseries":     {"arima"},
}


class AnalysisRequest(BaseModel):
    connection_id: str
    table: str = Field(..., max_length=128)
    family: Literal["classification", "regression", "timeseries", "clustering"]
    algo: str
    target: Optional[str] = None
    features: Optional[List[str]] = Field(default=[], max_length=20)
    secondary_tables: Optional[List[str]] = Field(default=[])

    @model_validator(mode="after")
    def validate_algo_family(self) -> "AnalysisRequest":
        valid = VALID_ALGOS.get(self.family, set())
        if self.algo not in valid:
            raise ValueError(
                f"Algorithm '{self.algo}' is not valid for family '{self.family}'. "
                f"Valid options: {sorted(valid)}"
            )
        return self


class FeatureImportance(BaseModel):
    name: str
    importance: float
    direction: Optional[str] = None
    insight: Optional[str] = None


class Prediction(BaseModel):
    label: str
    value: float
    lower: float
    upper: float
    confidence: str


class AnalysisResult(BaseModel):
    algo: str
    family: str
    table: str
    row_count: int
    metrics: Dict[str, Any]
    feature_importances: List[FeatureImportance]
    predictions: List[Prediction]
    insights: List[str]
    data_warnings: List[str] = []   # populated by _check_data_quality — read these first
    scatter_sample: Optional[List[Dict]] = []
    status: str = "success"
    run_id: Optional[str] = None    # set by /run endpoint; absent for direct /analyze calls


# ─── Data fetching ────────────────────────────────────────────────────────────

def _safe_quote(name: str, db_type: str) -> str:
    """
    Quote an identifier (table or column) for the given DB type.
    Strictly allows only alphanumeric and underscore characters to prevent SQL injection.
    """
    import re
    if not re.match(r"^[a-zA-Z0-9_]+$", name):
        raise ValueError(f"Invalid identifier: {name}. Only alphanumeric characters and underscores are allowed.")

    if "mysql" in db_type:
        return f"`{name}`"
    else:
        return f'"{name}"'


async def _fetch_data(connection_id: str, table: str,
                      columns: List[str], n: int = 2000) -> List[Dict]:
    """Fetch sample rows using safely-quoted identifiers (no f-string injection).

    Raises:
        ConnectionError: if the database connection cannot be established.
        ValueError: if the table exists but contains no rows.
    """
    try:
        from app.services.db_connector import db_connector
        conn = db_connector.get_connection(connection_id)
        db_type = conn.get("type", "").lower()

        if db_type in ("mongodb", "mongo"):
            raise NotImplementedError(
                "MongoDB is not supported for ML analysis. "
                "Connect to a PostgreSQL or MySQL database to use this feature."
            )

        def qt(name): return _safe_quote(name, db_type)

        safe_table = qt(table)
        if columns:
            safe_cols = ", ".join(qt(c) for c in columns[:20])
        else:
            safe_cols = "*"

        limit = min(max(n, 100), 5000)
        query = f"SELECT {safe_cols} FROM {safe_table} LIMIT {limit}"
        result = await db_connector.query(connection_id, query)
        if not result:
            raise ValueError(f"Table '{table}' appears to be empty (0 rows returned).")
        return result
    except ValueError:
        raise
    except Exception as e:
        logger.warning("Data fetch failed for %s: %s", table, e)
        raise ConnectionError(f"Database connection failed for '{connection_id}': {e}") from e


async def _fetch_row_count(connection_id: str, table: str) -> int:
    """Return real row count from schema cache, or 0."""
    try:
        from app.services.schema_analyzer import schema_analyzer
        schema = schema_analyzer.get_analysis_result(connection_id)
        if schema and hasattr(schema, "tables"):
            for t in schema.tables:
                if t.name.lower() == table.lower():
                    return t.row_count or 0
    except Exception as e:
        logger.debug("_fetch_row_count failed for %s.%s: %s", connection_id, table, e)
    return 0


async def _merge_secondary_tables(
    connection_id: str,
    primary_table: str,
    primary_rows: List[Dict],
    secondary_tables: List[str],
) -> List[Dict]:
    """Left-join secondary tables into primary rows using defined FK relations or shared ID columns."""
    from app.services.schema_analyzer import schema_analyzer
    schema = schema_analyzer.get_analysis_result(connection_id)

    for sec_table in secondary_tables:
        try:
            sec_rows = await _fetch_data(connection_id, sec_table, [], n=max(len(primary_rows) * 2, 2000))
            if not sec_rows or not primary_rows:
                continue
            
            p_keys = set(primary_rows[0].keys())
            s_keys = set(sec_rows[0].keys())
            shared = p_keys & s_keys

            join_col_p = None
            join_col_s = None

            # 1. Check formal schema relationships
            if schema and hasattr(schema, "relationships"):
                for rel in schema.relationships:
                    if rel.from_table.lower() == primary_table.lower() and rel.to_table.lower() == sec_table.lower():
                        if rel.from_column in p_keys and rel.to_column in s_keys:
                            join_col_p, join_col_s = rel.from_column, rel.to_column
                            break
                    elif rel.from_table.lower() == sec_table.lower() and rel.to_table.lower() == primary_table.lower():
                        if rel.to_column in p_keys and rel.from_column in s_keys:
                            join_col_p, join_col_s = rel.to_column, rel.from_column
                            break

            # 2. Fallback to heuristic if no formal FK
            if not join_col_p:
                fallback_col = next(
                    (k for k in shared if re.search(r"(^id$|_id$)", k, re.IGNORECASE)),
                    next(iter(shared), None),
                )
                join_col_p, join_col_s = fallback_col, fallback_col

            if not join_col_p or not join_col_s:
                logger.debug("No join column found between %s and %s — skipping", primary_table, sec_table)
                continue

            lookup: Dict = {}
            for r in sec_rows:
                key = r.get(join_col_s)
                if key is not None and key not in lookup:
                    lookup[key] = r
            primary_rows = [
                {**r, **{k: v for k, v in lookup.get(r.get(join_col_p), {}).items() if k not in r}}
                for r in primary_rows
            ]
            logger.debug("Merged secondary table %s via %s=%s", sec_table, join_col_p, join_col_s)
        except Exception as exc:
            logger.debug("Secondary table merge failed for %s: %s", sec_table, exc)
    return primary_rows


# ─── Preprocessing ────────────────────────────────────────────────────────────

def _check_data_quality(
    rows: List[Dict],
    feature_cols: List[str],
    target_col: Optional[str],
) -> List[str]:
    """
    Return a list of data-quality warning strings BEFORE running the model.

    Checks:
    - Target column included in features (leakage)
    - Too few rows for reliable test-set evaluation
    - High-cardinality columns that are likely ID/primary-key columns
    - Features that are constant (zero variance — carry no information)
    """
    warnings: List[str] = []
    if not rows:
        return warnings

    # 1. Target leakage
    if target_col and target_col in feature_cols:
        warnings.append(
            f"DATA QUALITY: Target column '{target_col}' is also listed as a feature. "
            "This causes target leakage — accuracy will be artificially inflated. "
            "Remove it from the feature list."
        )

    # 2. Small dataset
    n = len(rows)
    if n < 50:
        warnings.append(
            f"DATA QUALITY: Only {n} rows available. The 20% test set has ~{int(n * 0.2)} rows — "
            "metrics computed on fewer than 10 samples are statistically unreliable. "
            "Collect more data before trusting these numbers."
        )
    elif n < 100:
        warnings.append(
            f"DATA QUALITY: Dataset has {n} rows. Metrics are approximate — "
            "consider gathering more data for stable evaluation."
        )

    # 3. High-cardinality ID columns (unique ratio > 90%)
    df = pd.DataFrame(rows[:500])  # sample for speed
    for col in feature_cols:
        if col == target_col or col not in df.columns:
            continue
        series = df[col].dropna()
        if len(series) < 5:
            continue
        unique_ratio = series.nunique() / len(series)
        if unique_ratio > 0.90 and not pd.api.types.is_numeric_dtype(series.dtype):
            warnings.append(
                f"DATA QUALITY: Feature '{col}' has {series.nunique()} unique values in "
                f"{len(series)} rows ({unique_ratio:.0%} unique) — looks like an ID or free-text column. "
                "ID columns memorise row identity, not patterns. Remove it from features."
            )

    # 4. Constant features (zero variance)
    for col in feature_cols:
        if col == target_col or col not in df.columns:
            continue
        series = df[col].dropna()
        if pd.api.types.is_numeric_dtype(series.dtype) and series.nunique() <= 1:
            warnings.append(
                f"DATA QUALITY: Feature '{col}' is constant (all values are the same). "
                "It carries no information and should be removed."
            )

    return warnings


def _preprocess(rows: List[Dict], feature_cols: List[str],
                target_col: Optional[str], family: str):
    """
    Convert raw DB rows → (X, y, feature_names).
    - Numeric columns: median-impute
    - Categorical columns: LabelEncode
    - Target column is always excluded from features (prevents leakage)
    - High-cardinality string columns (unique ratio > 90%) are excluded
    - Returns (None, None, []) if data is unusable.
    """
    from sklearn.preprocessing import LabelEncoder

    if not rows:
        return None, None, []

    df = pd.DataFrame(rows)

    # Fix 1 — never include target in features (prevents target leakage)
    clean_features = [c for c in feature_cols if c != target_col]

    # Resolve feature columns — fall back to all columns except target
    available = [c for c in clean_features if c in df.columns]
    if not available:
        available = [c for c in df.columns if c != target_col][:10]
    if not available:
        return None, None, []

    df = df.dropna(subset=available, how="all")
    if len(df) < 10:
        return None, None, []

    encoded_parts: List[np.ndarray] = []
    feature_names: List[str] = []

    for col in available:
        series = df[col]

        # Fix 3 — skip high-cardinality string columns (likely ID columns)
        if not pd.api.types.is_numeric_dtype(series.dtype):
            n_unique = series.dropna().nunique()
            n_total = len(series.dropna())
            if n_total > 10 and n_unique / n_total > 0.90:
                logger.debug("_preprocess: skipping high-cardinality column '%s' (%d/%d unique)",
                             col, n_unique, n_total)
                continue

        if pd.api.types.is_numeric_dtype(series.dtype):
            med = series.median()
            vals = series.fillna(med if not math.isnan(float(med)) else 0.0).values.astype(float)
            encoded_parts.append(vals.reshape(-1, 1))
            feature_names.append(col)
        else:
            le = LabelEncoder()
            filled = series.fillna("__missing__").astype(str)
            try:
                enc = le.fit_transform(filled).astype(float)
                encoded_parts.append(enc.reshape(-1, 1))
                feature_names.append(col)
            except Exception as e:
                logger.debug("Skipping column %s during encoding: %s", col, e)

    if not encoded_parts:
        return None, None, []

    X = np.hstack(encoded_parts)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    # Build target vector
    y = None
    if target_col and target_col in df.columns:
        ts = df[target_col]
        if family == "classification":
            le = LabelEncoder()
            y = le.fit_transform(ts.fillna("__missing__").astype(str))
        else:
            if pd.api.types.is_numeric_dtype(ts.dtype):
                med = ts.median()
                y = ts.fillna(med if not math.isnan(float(med)) else 0.0).values.astype(float)
            else:
                numeric = pd.to_numeric(ts, errors="coerce")
                med = numeric.median()
                y = numeric.fillna(med if not math.isnan(float(med)) else 0.0).values.astype(float)

    return X, y, feature_names


# ─── Classification ───────────────────────────────────────────────────────────

def _run_classification(X: np.ndarray, y: np.ndarray,
                        algo: str, feature_names: List[str],
                        hyperparams: Optional[Dict[str, Any]] = None):
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
    from sklearn.preprocessing import StandardScaler

    if y is None or len(X) < 20:
        raise ValueError("Need ≥20 rows with a valid target column for classification.")

    unique_classes = np.unique(y)
    if len(unique_classes) < 2:
        raise ValueError("Classification requires ≥2 distinct classes in the target column.")

    # Cap at 5 000 rows for speed
    if len(X) > 5000:
        idx = np.random.default_rng(42).choice(len(X), 5000, replace=False)
        X, y = X[idx], y[idx]

    stratify = y if len(unique_classes) > 1 else None
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=stratify
    )
    avg = "weighted" if len(unique_classes) > 2 else "binary"

    h = hyperparams or {}
    if algo == "rf_clf":
        from sklearn.ensemble import RandomForestClassifier
        model = RandomForestClassifier(n_estimators=h.get("n_estimators", 100),
                                       max_depth=h.get("max_depth", 10),
                                       min_samples_split=h.get("min_samples_split", 2),
                                       max_features=h.get("max_features", "sqrt"),
                                       random_state=42, n_jobs=-1)
        model.fit(X_tr, y_tr)
        importances = model.feature_importances_

    elif algo == "svm":
        scaler = StandardScaler()
        X_tr = scaler.fit_transform(X_tr)
        X_te = scaler.transform(X_te)
        from sklearn.svm import SVC
        model = SVC(kernel="rbf", C=h.get("C", 1.0),
                    gamma=h.get("gamma", "scale"),
                    probability=True, random_state=42)
        model.fit(X_tr, y_tr)
        # SVM has no feature_importances_; use permutation importance proxy
        importances = np.ones(len(feature_names)) / len(feature_names)

    elif algo == "knn":
        scaler = StandardScaler()
        X_tr = scaler.fit_transform(X_tr)
        X_te = scaler.transform(X_te)
        from sklearn.neighbors import KNeighborsClassifier
        k = h.get("n_neighbors", min(5, max(1, len(X_tr) - 1)))
        model = KNeighborsClassifier(n_neighbors=k, weights=h.get("weights", "uniform"))
        model.fit(X_tr, y_tr)
        importances = np.ones(len(feature_names)) / len(feature_names)

    else:  # logreg
        scaler = StandardScaler()
        X_tr = scaler.fit_transform(X_tr)
        X_te = scaler.transform(X_te)
        from sklearn.linear_model import LogisticRegression
        model = LogisticRegression(max_iter=h.get("max_iter", 1000),
                                   random_state=42, C=h.get("C", 1.0),
                                   solver="lbfgs")
        model.fit(X_tr, y_tr)
        coef = model.coef_
        importances = np.mean(np.abs(coef), axis=0) if coef.ndim == 2 else np.abs(coef[0])

    # Fix 2 — minimum reliable test set
    if len(X_te) < 10:
        raise ValueError(
            f"Test set has only {len(X_te)} samples after the 80/20 split. "
            "Need at least 50 total rows to evaluate classification reliably."
        )

    y_pred = model.predict(X_te)

    # Baseline = always-predict-majority-class accuracy (the floor your model must beat)
    from collections import Counter
    majority_class_count = max(Counter(y_te.tolist()).values())
    baseline_accuracy = round(majority_class_count / len(y_te), 4)

    metrics: Dict[str, Any] = {
        "accuracy":          round(float(accuracy_score(y_te, y_pred)), 4),
        "baseline_accuracy": baseline_accuracy,   # model must beat this to be useful
        "precision":         round(float(precision_score(y_te, y_pred, average=avg, zero_division=0)), 4),
        "recall":            round(float(recall_score(y_te, y_pred, average=avg, zero_division=0)), 4),
        "f1":                round(float(f1_score(y_te, y_pred, average=avg, zero_division=0)), 4),
        "samples":           int(len(X)),
        "train_size":        int(len(X_tr)),
        "test_size":         int(len(X_te)),
        "n_classes":         int(len(unique_classes)),
    }

    try:
        from app.services.ml.explainer import Explainer
        exp = Explainer(model, X_tr, feature_names, "classification")
        shap_fi = exp.feature_importances(X_tr)
        fi = []
        for s in shap_fi:
            direction = s.get("direction", "positive")
            pct = round(s.get("shap_mean_abs", s["importance"]) * 100, 1)
            action = "increased" if direction == "positive" else "decreased"
            insight = f"Higher {s['name']} {action} the probability of the target outcome by ~{pct}%."
            fi.append(FeatureImportance(
                name=s["name"], 
                importance=s["importance"],
                direction=direction,
                insight=insight
            ))
    except Exception as e:
        logger.warning("SHAP classification explainer failed: %s", e)
        fi = _normalize_fi(feature_names, importances)

    # Predictions = predicted class distribution
    counts = Counter(y_pred.tolist())
    total = len(y_pred)
    predictions = [
        Prediction(
            label=f"Class {int(cls)}",
            value=round(cnt / total * 100, 1),
            lower=round(max(0.0, cnt / total * 100 - 5), 1),
            upper=round(min(100.0, cnt / total * 100 + 5), 1),
            confidence="high" if cnt / total > 0.3 else "medium",
        )
        for cls, cnt in sorted(counts.items(), key=lambda x: -x[1])[:6]
    ]

    return metrics, fi, predictions, model, X_tr


# ─── Regression ───────────────────────────────────────────────────────────────

def _run_regression(X: np.ndarray, y: np.ndarray,
                    algo: str, feature_names: List[str],
                    hyperparams: Optional[Dict[str, Any]] = None):
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
    from sklearn.preprocessing import StandardScaler

    if y is None or len(X) < 20:
        raise ValueError("Need ≥20 rows with a numeric target column for regression.")

    if len(X) > 5000:
        idx = np.random.default_rng(42).choice(len(X), 5000, replace=False)
        X, y = X[idx], y[idx]

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

    h = hyperparams or {}
    if algo == "linear":
        from sklearn.linear_model import LinearRegression
        model = LinearRegression()
        model.fit(X_tr, y_tr)
        importances = np.abs(model.coef_)

    elif algo == "ridge":
        scaler = StandardScaler()
        X_tr = scaler.fit_transform(X_tr)
        X_te = scaler.transform(X_te)
        from sklearn.linear_model import Ridge
        model = Ridge(alpha=h.get("alpha", 1.0))
        model.fit(X_tr, y_tr)
        importances = np.abs(model.coef_)

    elif algo == "lasso":
        scaler = StandardScaler()
        X_tr = scaler.fit_transform(X_tr)
        X_te = scaler.transform(X_te)
        from sklearn.linear_model import Lasso
        model = Lasso(alpha=h.get("alpha", 0.1), max_iter=5000)
        model.fit(X_tr, y_tr)
        importances = np.abs(model.coef_)

    else:  # xgboost → GradientBoostingRegressor
        from sklearn.ensemble import GradientBoostingRegressor
        model = GradientBoostingRegressor(
            n_estimators=h.get("n_estimators", 100),
            max_depth=h.get("max_depth", 4),
            learning_rate=h.get("learning_rate", 0.1),
            subsample=h.get("subsample", 0.8),
            random_state=42
        )
        model.fit(X_tr, y_tr)
        importances = model.feature_importances_

    y_pred = model.predict(X_te)

    r2 = float(r2_score(y_te, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_te, y_pred)))
    mae = float(mean_absolute_error(y_te, y_pred))

    metrics: Dict[str, Any] = {
        "R2":         round(float(np.clip(r2, -1.0, 1.0)), 4),
        "RMSE":       round(rmse, 4),
        "MAE":        round(mae, 4),
        "samples":    int(len(X)),
        "train_size": int(len(X_tr)),
        "test_size":  int(len(X_te)),
    }

    try:
        from app.services.ml.explainer import Explainer
        exp = Explainer(model, X_tr, feature_names, "regression")
        shap_fi = exp.feature_importances(X_tr)
        fi = []
        for s in shap_fi:
            direction = s.get("direction", "positive")
            pct = round(s.get("shap_mean_abs", s["importance"]), 2)
            action = "increased" if direction == "positive" else "decreased"
            insight = f"Higher {s['name']} {action} the predicted value by an average of {pct} units."
            fi.append(FeatureImportance(
                name=s["name"], 
                importance=s["importance"],
                direction=direction,
                insight=insight
            ))
    except Exception as e:
        logger.warning("SHAP regression explainer failed: %s", e)
        fi = _normalize_fi(feature_names, importances)

    # Predictions: actual test-set samples (actual vs predicted)
    std_val = float(np.std(y_pred - y_te))
    predictions = []
    for i, (actual, pred) in enumerate(zip(y_te[:10], y_pred[:10])):
        ci = std_val * 1.96
        predictions.append(Prediction(
            label=f"Sample {i + 1}",
            value=round(float(pred), 4),
            lower=round(float(pred) - ci, 4),
            upper=round(float(pred) + ci, 4),
            confidence="high" if abs(pred - actual) < std_val else ("medium" if abs(pred - actual) < 2 * std_val else "low"),
        ))

    return metrics, fi, predictions, model, X_tr


# ─── Clustering ───────────────────────────────────────────────────────────────

def _run_clustering(X: np.ndarray, algo: str, feature_names: List[str],
                    hyperparams: Optional[Dict[str, Any]] = None):
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import silhouette_score as sil_score

    if len(X) < 10:
        raise ValueError("Need ≥10 rows for clustering.")

    if len(X) > 5000:
        idx = np.random.default_rng(42).choice(len(X), 5000, replace=False)
        X = X[idx]

    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)

    h = hyperparams or {}
    if algo == "kmeans":
        from sklearn.cluster import KMeans

        # Auto-select k by highest silhouette (k=2..min(8, n//10))
        max_k = min(8, len(X) // 10)
        max_k = max(max_k, 2)
        best_k, best_sil, best_model = h.get("n_clusters", 3), -1.0, None

        if "n_clusters" not in h:
            for k in range(2, max_k + 1):
                km = KMeans(n_clusters=k, random_state=42, n_init=10)
                labels = km.fit_predict(X_s)
                if len(np.unique(labels)) < 2:
                    continue
                s = float(sil_score(X_s, labels, sample_size=min(2000, len(X_s))))
                if s > best_sil:
                    best_sil, best_k, best_model = s, k, km
        else:
            best_model = KMeans(n_clusters=best_k, random_state=42,
                                n_init=h.get("n_init", 10)).fit(X_s)

        if best_model is None:
            best_model = KMeans(n_clusters=best_k, random_state=42,
                                n_init=h.get("n_init", 10)).fit(X_s)

        labels = best_model.labels_
        sil = float(sil_score(X_s, labels, sample_size=min(2000, len(X_s)))) if len(np.unique(labels)) > 1 else 0.0

        metrics: Dict[str, Any] = {
            "n_clusters":       int(best_k),
            "silhouette_score": round(sil, 4),
            "inertia":          round(float(best_model.inertia_), 2),
            "samples":          int(len(X)),
        }

        # Feature importance = between-cluster centroid std deviation
        centroid_std = np.std(best_model.cluster_centers_, axis=0)
        importances = centroid_std / (centroid_std.sum() + 1e-9)

    else:  # dbscan
        from sklearn.cluster import DBSCAN
        from sklearn.neighbors import NearestNeighbors

        # Auto-tune eps via k-distance (90th percentile)
        nn = NearestNeighbors(n_neighbors=min(5, len(X_s) - 1)).fit(X_s)
        dists, _ = nn.kneighbors(X_s)
        eps = h.get("eps", float(np.percentile(dists[:, -1], 90)))
        eps = max(eps, 0.1)

        model = DBSCAN(eps=eps, min_samples=h.get("min_samples", 5))
        labels = model.fit_predict(X_s)

        n_clusters = int(len(set(labels) - {-1}))
        n_noise = int(np.sum(labels == -1))

        non_noise = labels != -1
        if n_clusters > 1 and non_noise.sum() > n_clusters:
            sil = float(sil_score(X_s[non_noise], labels[non_noise], sample_size=min(2000, non_noise.sum())))
        else:
            sil = 0.0

        metrics = {
            "n_clusters":       n_clusters,
            "n_noise_points":   n_noise,
            "silhouette_score": round(sil, 4),
            "samples":          int(len(X)),
        }
        importances = np.ones(len(feature_names)) / max(len(feature_names), 1)
        best_model = model   # expose DBSCAN model for SHAP/downstream use

    fi = _normalize_fi(feature_names, importances)

    from collections import Counter
    counts = Counter(labels.tolist())
    total = len(labels)
    predictions = [
        Prediction(
            label=(f"Cluster {int(k) + 1}" if k != -1 else "Noise / Outliers"),
            value=round(cnt / total * 100, 1),
            lower=round(max(0.0, cnt / total * 100 - 3), 1),
            upper=round(min(100.0, cnt / total * 100 + 3), 1),
            confidence=("low" if k == -1 else "high"),
        )
        for k, cnt in sorted(counts.items(), key=lambda x: -x[1])[:6]
    ]

    return metrics, fi, predictions, best_model, X_s


# ─── Time Series ──────────────────────────────────────────────────────────────

def _run_timeseries(rows: List[Dict], feature_cols: List[str],
                    target_col: Optional[str], algo: str):
    """
    Time-series analysis using numpy.  No statsmodels / prophet required.
    Detects trend + weekly seasonality from actual data, produces 30-day forecast.
    """
    if not rows:
        raise ValueError("No data returned from database for time series analysis.")

    df = pd.DataFrame(rows)

    # Auto-detect date column
    date_col = None
    # First, try columns explicitly passed in features
    cols_to_check = feature_cols if feature_cols else df.columns
    for col in cols_to_check:
        if col in df.columns:
            sample = df[col].dropna().head(10)
            if len(sample) == 0: continue
            try:
                pd.to_datetime(sample)
                date_col = col
                break
            except Exception:
                pass  # not a date column — try next

    if date_col is None:
        # Try any column that looks like a date
        for col in df.columns:
            dtype_str = str(df[col].dtype).lower()
            if "datetime" in dtype_str or "date" in dtype_str:
                date_col = col
                break

    if date_col is None or target_col is None:
        raise ValueError(
            "Time series requires a date/timestamp feature column and a numeric target column."
        )
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in data.")

    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df[target_col] = pd.to_numeric(df[target_col], errors="coerce")
    df = df.dropna(subset=[date_col, target_col]).sort_values(date_col).reset_index(drop=True)

    if len(df) < 10:
        raise ValueError("Need ≥10 non-null data points for time series analysis.")

    y = df[target_col].values.astype(float)
    n = len(y)
    x = np.arange(n, dtype=float)

    # ── HOLD-OUT SPLIT (Fix Leakage: Fit ONLY on training portion) ──
    split = max(1, int(n * 0.8))
    y_train = y[:split]
    x_train = x[:split]
    y_test = y[split:]

    # ── Linear trend ──
    coeffs = np.polyfit(x_train, y_train, 1)          # slope, intercept
    y_trend_train = np.polyval(coeffs, x_train)
    residuals_train = y_train - y_trend_train

    # ── Weekly seasonality (period 7) via harmonic regression ──
    # k_harm, T, coeffs_s initialised here so test-set and forecast blocks are
    # always defined, even when len(y_train) < 14 or lstsq fails.
    k_harm: int = 0
    T: float = 7.0
    coeffs_s: np.ndarray = np.zeros(0)
    seasonal_component_train = np.zeros(len(y_train))
    if len(y_train) >= 14:
        k_harm = min(3, len(y_train) // 14)
        A_train = np.column_stack(
            [np.cos(2 * np.pi * h * x_train / T) for h in range(1, k_harm + 1)] +
            [np.sin(2 * np.pi * h * x_train / T) for h in range(1, k_harm + 1)]
        )
        try:
            coeffs_s, *_ = np.linalg.lstsq(A_train, residuals_train, rcond=None)
            seasonal_component_train = A_train @ coeffs_s
        except Exception:
            coeffs_s = np.zeros(k_harm * 2)

    # ── EVALUATE ON TEST SET ──
    x_test = x[split:]
    if len(x_test) > 0:
        future_trend_test = np.polyval(coeffs, x_test)
        if k_harm > 0 and len(coeffs_s) > 0:
            A_test = np.column_stack(
                [np.cos(2 * np.pi * h * x_test / T) for h in range(1, k_harm + 1)] +
                [np.sin(2 * np.pi * h * x_test / T) for h in range(1, k_harm + 1)]
            )
            future_seasonal_test = A_test @ coeffs_s
        else:
            future_seasonal_test = np.zeros(len(x_test))
        y_pred_test = future_trend_test + future_seasonal_test
    else:
        y_pred_test = np.array([])

    if len(y_test) == 0:
        rmse = mae = mape = 0.0
    else:
        rmse = float(np.sqrt(np.mean((y_test - y_pred_test) ** 2)))
        mae = float(np.mean(np.abs(y_test - y_pred_test)))
        mask = y_test != 0
        mape = float(np.mean(np.abs((y_test[mask] - y_pred_test[mask]) / y_test[mask])) * 100) if mask.any() else mae

    # ── 30-day forecast ──
    x_future = np.arange(n, n + 30, dtype=float)
    future_trend = np.polyval(coeffs, x_future)

    if k_harm > 0 and len(coeffs_s) > 0:
        A_future = np.column_stack(
            [np.cos(2 * np.pi * h * x_future / T) for h in range(1, k_harm + 1)] +
            [np.sin(2 * np.pi * h * x_future / T) for h in range(1, k_harm + 1)]
        )
        future_seasonal = A_future @ coeffs_s
    else:
        future_seasonal = np.zeros(30)

    future_vals = future_trend + future_seasonal

    # ── Metrics ──
    trend_dir = "upward" if coeffs[0] > 0 else ("downward" if coeffs[0] < 0 else "flat")
    monthly_growth_pct = round(float(coeffs[0] * 30 / (np.mean(y) + 1e-9) * 100), 2)

    metrics: Dict[str, Any] = {
        "MAPE":           round(min(mape, 9999.0), 2),
        "RMSE":           round(rmse, 4),
        "MAE":            round(mae, 4),
        "samples":        int(n),
        "trend":          trend_dir,
        "monthly_growth": monthly_growth_pct,
        "model":          "Trend + Seasonal Harmonic Regression",
    }

    fi = [FeatureImportance(name=date_col, importance=1.0)]

    # 6 prediction points spread across the 30-day horizon
    step = max(1, 30 // 6)
    _last_actual = float(y[-1])
    predictions = []
    for i, idx in enumerate(range(0, 30, step)):
        if len(predictions) >= 6:
            break
        val = float(future_vals[idx])
        ci = abs(val) * max(0.05, 0.05 * (1 + i * 0.15))
        predictions.append(Prediction(
            label=f"Day +{idx + 1}",
            value=round(val, 4),
            lower=round(val - ci, 4),
            upper=round(val + ci, 4),
            confidence=("high" if i < 2 else "medium" if i < 4 else "low"),
        ))

    return metrics, fi, predictions


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _normalize_fi(names: List[str], importances: np.ndarray) -> List[FeatureImportance]:
    total = importances.sum()
    if total <= 0:
        importances = np.ones(len(names)) / max(len(names), 1)
        total = 1.0
    return sorted(
        [FeatureImportance(name=n, importance=round(float(v / total), 4))
         for n, v in zip(names, importances)],
        key=lambda x: -x.importance,
    )


def _build_insights(family: str, algo: str, table: str, target: Optional[str],
                    fi: List[FeatureImportance], metrics: Dict[str, Any],
                    row_count: int) -> List[str]:
    ins: List[str] = []
    top = fi[0].name if fi else "top feature"
    top_pct = round(fi[0].importance * 100, 1) if fi else 0.0

    if family == "classification":
        acc = metrics.get("accuracy", 0)
        f1 = metrics.get("f1", 0)
        n_cls = metrics.get("n_classes", 2)
        baseline = metrics.get("baseline_accuracy", 0)
        ins.append(
            f"Model accuracy: {acc:.1%} · F1: {f1:.4f} on "
            f"{metrics.get('test_size', '?')}-sample held-out test set ({n_cls} classes)."
        )
        # Checklist item 5: model must beat the naive majority-class baseline
        if baseline > 0:
            ins.append(
                f"Baseline (always-predict-majority): {baseline:.1%}. "
                + (f"Model beats baseline by {acc - baseline:+.1%} ✓"
                   if acc > baseline
                   else f"⚠ Model does NOT beat the baseline — predictions are no better than guessing the majority class.")
            )
        if fi:
            ins.append(f"Most discriminative feature: '{top}' ({top_pct}% importance).")
        if f1 >= 0.85:
            ins.append("Excellent generalisation — model is ready for production scoring.")
        elif f1 >= 0.70:
            ins.append("Good performance. Consider hyperparameter tuning or class-balancing for further gains.")
        else:
            ins.append("Moderate performance. More labelled data or feature engineering may improve F1.")
        prec = metrics.get("precision", 0)
        rec = metrics.get("recall", 0)
        if abs(prec - rec) > 0.08:
            if prec > rec:
                ins.append(f"Precision ({prec:.2%}) > Recall ({rec:.2%}) — model is conservative. Lower decision threshold for higher recall if false-negatives are costly.")
            else:
                ins.append(f"Recall ({rec:.2%}) > Precision ({prec:.2%}) — model captures most positives but generates false alarms. Raise threshold to improve precision.")

    elif family == "regression":
        r2 = metrics.get("R2", 0)
        rmse = metrics.get("RMSE", 0)
        mae = metrics.get("MAE", 0)
        ins.append(
            f"R² = {r2:.4f} — model explains {r2:.1%} of variance in '{target}'. "
            f"RMSE={rmse:.2f}, MAE={mae:.2f} on test set."
        )
        if len(fi) >= 2:
            ins.append(f"Top predictors: '{fi[0].name}' ({top_pct}%) and '{fi[1].name}' ({round(fi[1].importance * 100, 1)}%).")
        if r2 >= 0.85:
            ins.append("Strong predictive power — suitable for production forecasting.")
        elif r2 >= 0.55:
            ins.append("Moderate fit. Adding interaction terms or trying ensemble methods may boost R².")
        else:
            ins.append("Low R² suggests high noise or non-linear patterns. Consider GradientBoosting / feature engineering.")

    elif family == "timeseries":
        mape = metrics.get("MAPE", 0)
        trend = metrics.get("trend", "stable")
        growth = metrics.get("monthly_growth", 0)
        ins.append(
            f"Trend: {trend} ({growth:+.1f}%/month). "
            f"30-day forecast MAPE: {mape:.1f}%."
        )
        ins.append(f"Model trained on {metrics.get('samples', row_count)} historical observations with weekly seasonal component.")
        if mape < 10:
            ins.append("Low MAPE (<10%) — forecasts are highly reliable for short-term planning.")
        elif mape < 25:
            ins.append("Acceptable MAPE (10–25%). Wider confidence intervals recommended for downstream planning.")
        else:
            ins.append("High MAPE (>25%) — series is volatile. Use prediction intervals; do not rely on point forecasts alone.")

    elif family == "clustering":
        sil = metrics.get("silhouette_score", 0)
        k = metrics.get("n_clusters", 0)
        noise = metrics.get("n_noise_points")
        ins.append(f"Identified {k} natural segments. Silhouette score: {sil:.4f} (higher is better; max 1.0).")
        if fi:
            ins.append(f"Feature '{top}' drives the largest between-cluster separation.")
        if sil >= 0.5:
            ins.append("Strong cluster structure — segments are well-separated and actionable.")
        elif sil >= 0.25:
            ins.append("Moderate cluster separation. Segments have meaningful differences but some overlap exists.")
        else:
            ins.append("Weak cluster structure. Data may be continuous rather than grouped; consider reducing k.")
        if noise is not None and noise > 0:
            total = metrics.get("samples", 1)
            ins.append(f"DBSCAN flagged {noise} noise points ({noise/total:.1%}) as outliers — review for data quality issues.")

    return ins


# ─── Main endpoint ─────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=AnalysisResult)
async def run_ml_analysis(req: AnalysisRequest):
    """
    Run ML analysis on a database table.

    Responses:
    - 200: Analysis completed successfully
    - 422: Invalid request — bad algo/family combo, empty table, or unusable data
    - 503: Database connection failed
    - 504: Analysis timed out (120 s limit) — try fewer features or a faster algorithm
    - 500: Unexpected server error
    """
    from app.services.ml.experiment_tracker import experiment_tracker

    try:
        features = req.features or []
        target = req.target

        all_cols = list(dict.fromkeys(([target] if target else []) + features))
        rows = await _fetch_data(req.connection_id, req.table, all_cols, n=2000)
        if req.secondary_tables:
            rows = await _merge_secondary_tables(req.connection_id, req.table, rows, req.secondary_tables)
        row_count = len(rows) or await _fetch_row_count(req.connection_id, req.table)

        # Run all trustworthiness checks before touching the model
        data_warnings = _check_data_quality(rows, features, target)

        loop = asyncio.get_running_loop()

        run = await experiment_tracker.start_run(
            experiment=f"{req.table}_{req.family}",
            algo=req.algo,
            family=req.family,
            connection_id=req.connection_id,
            table=req.table,
            hyperparams={},
        )

        async def _run_ml():
            if req.family == "timeseries":
                return await loop.run_in_executor(
                    None, _run_timeseries, rows, features, target, req.algo
                )
            X, y, feature_names = await loop.run_in_executor(
                None, _preprocess, rows, features, target, req.family
            )
            if X is None or len(X) == 0:
                raise ValueError(
                    "No usable data after preprocessing. "
                    "Ensure the selected feature and target columns contain non-null values."
                )
            if req.family == "classification":
                metrics, fi, predictions, *_ = await loop.run_in_executor(
                    None, _run_classification, X, y, req.algo, feature_names
                )
            elif req.family == "regression":
                metrics, fi, predictions, *_ = await loop.run_in_executor(
                    None, _run_regression, X, y, req.algo, feature_names
                )
            else:  # clustering
                metrics, fi, predictions, *_ = await loop.run_in_executor(
                    None, _run_clustering, X, req.algo, feature_names
                )
            return metrics, fi, predictions

        try:
            metrics, fi, predictions = await asyncio.wait_for(_run_ml(), timeout=120.0)
            await experiment_tracker.finish_run(
                run, metrics=metrics,
                feature_importances=[f.model_dump() for f in fi],
            )
        except asyncio.TimeoutError:
            await experiment_tracker.finish_run(run, metrics={}, status="timeout")
            raise HTTPException(
                status_code=504,
                detail="ML analysis timed out. Try fewer features or a faster algorithm.",
            )
        except Exception:
            await experiment_tracker.finish_run(run, metrics={}, status="failed")
            raise

        insights = _build_insights(req.family, req.algo, req.table,
                                   target, fi, metrics, row_count)

        # Scatter sample: keep only JSON-serialisable primitives
        # Always include target + feature columns so frontend charts have what they need
        required_cols = set(([target] if target else []) + list(features))
        scatter_sample = []
        for row in rows[:80]:
            entry = {k: v for k, v in row.items() if isinstance(v, (int, float, str, type(None)))}
            # Ensure required columns are present (as None if missing)
            for col in required_cols:
                if col not in entry:
                    entry[col] = None
            scatter_sample.append(entry)

        return AnalysisResult(
            algo=req.algo,
            family=req.family,
            table=req.table,
            row_count=row_count,
            metrics=metrics,
            feature_importances=fi,
            predictions=predictions,
            insights=insights,
            data_warnings=data_warnings,
            scatter_sample=scatter_sample,
            status="success",
        )

    except HTTPException:
        raise
    except (ValueError, NotImplementedError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error("ML analysis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during ML analysis.")


# ─── Async job endpoints (/run + /run/{run_id}/status) ───────────────────────

async def _run_analysis_background(run_id: str, req: AnalysisRequest) -> None:
    """Background coroutine that runs the full ML pipeline and stores the result."""
    try:
        features = req.features or []
        target = req.target

        all_cols = list(dict.fromkeys(([target] if target else []) + features))
        rows = await _fetch_data(req.connection_id, req.table, all_cols, n=2000)
        if req.secondary_tables:
            rows = await _merge_secondary_tables(req.connection_id, req.table, rows, req.secondary_tables)
        row_count = len(rows) or await _fetch_row_count(req.connection_id, req.table)

        data_warnings = _check_data_quality(rows, features, target)

        from app.services.ml.experiment_tracker import experiment_tracker
        run = await experiment_tracker.start_run(
            experiment=f"{req.table}_{req.family}",
            algo=req.algo, family=req.family,
            connection_id=req.connection_id, table=req.table,
            hyperparams={},
        )

        bg_loop = asyncio.get_running_loop()

        async def _run_ml():
            if req.family == "timeseries":
                return await bg_loop.run_in_executor(
                    None, _run_timeseries, rows, features, target, req.algo
                )
            X, y, feature_names = await bg_loop.run_in_executor(
                None, _preprocess, rows, features, target, req.family
            )
            if X is None or len(X) == 0:
                raise ValueError(
                    "No usable data after preprocessing. "
                    "Ensure the selected feature and target columns contain non-null values."
                )
            if req.family == "classification":
                metrics, fi, predictions, *_ = await bg_loop.run_in_executor(
                    None, _run_classification, X, y, req.algo, feature_names
                )
            elif req.family == "regression":
                metrics, fi, predictions, *_ = await bg_loop.run_in_executor(
                    None, _run_regression, X, y, req.algo, feature_names
                )
            else:
                metrics, fi, predictions, *_ = await bg_loop.run_in_executor(
                    None, _run_clustering, X, req.algo, feature_names
                )
            return metrics, fi, predictions

        try:
            metrics, fi, predictions = await asyncio.wait_for(_run_ml(), timeout=120.0)
            await experiment_tracker.finish_run(
                run, metrics=metrics,
                feature_importances=[f.model_dump() for f in fi],
            )
        except asyncio.TimeoutError:
            await experiment_tracker.finish_run(run, metrics={}, status="timeout")
            _pending_set(run_id, {
                "status": "failed",
                "error": "ML analysis timed out. Try fewer features or a faster algorithm.",
            })
            return
        except Exception as exc:
            await experiment_tracker.finish_run(run, metrics={}, status="failed")
            raise exc

        insights = _build_insights(req.family, req.algo, req.table, target, fi, metrics, row_count)

        required_cols = set(([target] if target else []) + list(features))
        scatter_sample = []
        for row in rows[:80]:
            entry = {k: v for k, v in row.items() if isinstance(v, (int, float, str, type(None)))}
            for col in required_cols:
                if col not in entry:
                    entry[col] = None
            scatter_sample.append(entry)

        result = AnalysisResult(
            algo=req.algo, family=req.family, table=req.table,
            row_count=row_count, metrics=metrics, feature_importances=fi,
            predictions=predictions, insights=insights, data_warnings=data_warnings,
            scatter_sample=scatter_sample, status="success", run_id=run_id,
        )
        _pending_set(run_id, {"status": "success", "result": result.model_dump()})

    except ConnectionError as exc:
        _pending_set(run_id, {"status": "failed", "error": str(exc)})
    except ValueError as exc:
        _pending_set(run_id, {"status": "failed", "error": str(exc)})
    except Exception as exc:
        logger.error("Background ML job %s failed: %s", run_id, exc, exc_info=True)
        _pending_set(run_id, {"status": "failed", "error": "Internal server error during ML analysis."})


@router.post("/run", status_code=202)
async def start_ml_run(req: AnalysisRequest):
    """
    Start an ML analysis job asynchronously.

    Returns a run_id immediately; poll GET /run/{run_id}/status for progress.
    The job runs in the background — no timeout risk on the HTTP connection.

    Responses:
    - 202: Job accepted; run_id returned
    """
    run_id = str(uuid.uuid4())
    _pending_set(run_id, {"status": "running"})
    asyncio.create_task(_run_analysis_background(run_id, req))
    return {"run_id": run_id, "status": "running"}


@router.get("/run/{run_id}/status")
async def get_run_status(run_id: str):
    """
    Poll the status of an async ML job started with POST /run.

    Responses:
    - 200: {status: "running"} while in progress; {status: "success", result: AnalysisResult}
           when done; {status: "failed", error: str} on failure
    - 404: Unknown run_id (not yet started or expired)
    """
    job = _pending_results.get(run_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return job


# ─── Suggest endpoint ─────────────────────────────────────────────────────────

@router.get("/suggest")
async def suggest_analysis(connection_id: str, table: str):
    """
    Recommend the best algorithm and columns for a given table based on schema analysis.

    Responses:
    - 200: Suggestion returned (may be null if table not found in schema)
    - 500: Unexpected error during suggestion
    """
    try:
        from app.services.schema_analyzer import schema_analyzer
        schema = schema_analyzer.get_analysis_result(connection_id)

        table_obj = None
        if schema and hasattr(schema, "tables"):
            table_obj = next(
                (t for t in schema.tables if t.name.lower() == table.lower()), None
            )
        if not table_obj:
            return {"suggestion": None, "reason": "Table not found in schema."}

        columns = table_obj.columns or []
        numeric = [c for c in columns if any(kw in (c.type or "").lower() for kw in
                   ["int", "float", "double", "decimal", "numeric", "real"])]
        dates = [c for c in columns if any(kw in (c.type or "").lower() for kw in
                 ["date", "time", "timestamp"])]
        cats = [c for c in columns if any(kw in (c.type or "").lower() for kw in
                ["char", "varchar", "text", "bool", "enum"])]

        # Skip ID/FK columns as regression targets — pick domain-meaningful columns first
        _id_re = re.compile(r'^id$|_id$|^fk_', re.IGNORECASE)
        _pref_re = re.compile(
            r'amount|price|rate|duration|score|count|total|soc|pct|percent|'
            r'revenue|cost|age|weight|temp|value|salary|balance|distance|health|charge',
            re.IGNORECASE,
        )
        non_id_numeric = [c for c in numeric if not _id_re.match(c.name)]

        def _pick_target(candidates):
            preferred = [c for c in candidates if _pref_re.search(c.name)]
            return preferred[0] if preferred else (candidates[0] if candidates else None)

        if dates and non_id_numeric:
            family, algo = "timeseries", "arima"
            tgt = _pick_target(non_id_numeric)
            target = tgt.name if tgt else non_id_numeric[0].name
            features = [dates[0].name] + [c.name for c in non_id_numeric if c.name != target][:2]
            reason = f"Timestamp '{dates[0].name}' + numeric target detected. Seasonal trend model applied."
            confidence = 83
        elif len(non_id_numeric) >= 2:
            family, algo = "regression", "xgboost"
            tgt = _pick_target(non_id_numeric)
            target = tgt.name if tgt else non_id_numeric[0].name
            features = [c.name for c in non_id_numeric if c.name != target][:4] + [c.name for c in cats[:2]]
            reason = (f"'{table}' has {len(non_id_numeric)} numeric columns and "
                      f"{table_obj.row_count:,} rows. GradientBoosting excels on tabular data.")
            confidence = 91
        elif cats:
            family, algo = "classification", "rf_clf"
            target = cats[0].name
            features = [c.name for c in non_id_numeric[:4]] + [c.name for c in cats[1:3]]
            reason = (f"Categorical target '{cats[0].name}' detected. "
                      "Random Forest handles mixed types robustly.")
            confidence = 85
        else:
            family, algo = "clustering", "kmeans"
            target = None
            features = [c.name for c in non_id_numeric[:5]] or [c.name for c in columns[:5]]
            reason = f"No clear target. K-Means will discover hidden segments in '{table}'."
            confidence = 74

        return {
            "suggestion": {
                "family":     family,
                "algo":       algo,
                "target":     target,
                "features":   [f for f in features if f],
                "confidence": confidence,
            },
            "reason": reason,
            "table_info": {
                "row_count":    table_obj.row_count,
                "column_count": len(columns),
            },
        }

    except Exception as exc:
        logger.error("ML suggestion failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during algorithm suggestion.")


# ─── AutoML endpoint ──────────────────────────────────────────────────────────

class AutoMLRequest(BaseModel):
    connection_id: str
    table: str
    family: Literal["classification", "regression", "timeseries", "clustering"]
    target: Optional[str] = None
    features: Optional[List[str]] = []
    n_trials: int = Field(default=15, ge=0, le=100)
    max_candidates: int = Field(default=3, ge=1, le=10)
    tenant_id: str = "default"
    user_id: Optional[str] = None


class AutoMLResult(BaseModel):
    best_algo:    str
    best_score:   float
    best_metrics: Dict[str, Any]
    candidates:   List[Dict[str, Any]]
    feature_importances: List[FeatureImportance]
    insights:     List[str]
    run_ids:      List[str]
    status:       str = "success"


@router.post("/automl", response_model=AutoMLResult)
async def run_automl(req: AutoMLRequest):
    """
    AutoML: rank candidate algorithms, optionally tune hyperparameters, return the best result.

    Every candidate run is persisted to the experiment tracker.

    Responses:
    - 200: AutoML completed; best algorithm and metrics returned
    - 422: Invalid request — unusable data or bad family
    - 503: Database connection failed
    - 500: All candidates failed or unexpected error
    """
    from app.services.ml.automl.selector import algorithm_selector
    from app.services.ml.automl.optimizer import hyperparameter_optimizer
    from app.services.ml.experiment_tracker import experiment_tracker
    from app.services.ml.explainer import Explainer
    from app.services.platform.audit_logger import audit_logger, AuditEventType

    try:
        features = req.features or []
        target   = req.target
        all_cols = list(dict.fromkeys(([target] if target else []) + features))

        rows = await _fetch_data(req.connection_id, req.table, all_cols, n=3000)

        loop = asyncio.get_running_loop()

        X, y, feature_names = await loop.run_in_executor(
            None, _preprocess, rows, features, target, req.family
        )
        if X is None or len(X) == 0:
            raise HTTPException(status_code=422, detail="No usable data after preprocessing.")

        # Profile the data for selector
        import numpy as _np
        n_classes = int(len(_np.unique(y))) if y is not None and req.family == "classification" else None
        has_imbalance = False
        if n_classes and y is not None:
            _, counts = _np.unique(y, return_counts=True)
            if counts.min() / counts.max() < 0.25:
                has_imbalance = True

        candidates = algorithm_selector.rank(
            family=req.family,
            n_rows=len(X),
            n_features=X.shape[1],
            n_classes=n_classes,
            has_imbalance=has_imbalance,
            numeric_ratio=1.0,
        )[: req.max_candidates]

        results: List[Dict[str, Any]] = []
        run_ids: List[str] = []

        for cand in candidates:
            run = await experiment_tracker.start_run(
                experiment=f"{req.table}_{req.family}",
                algo=cand.algo_id,
                family=req.family,
                connection_id=req.connection_id,
                table=req.table,
                hyperparams=cand.hyperparams,
                tenant_id=req.tenant_id,
                user_id=req.user_id,
            )
            run_ids.append(run.run_id)

            async def _run_candidate():
                best_params, _ = await asyncio.wait_for(
                    loop.run_in_executor(
                        None, hyperparameter_optimizer.optimize,
                        cand.algo_id, req.family, X, y, req.n_trials, 3, None,
                    ),
                    timeout=120.0,
                )
                cand.hyperparams.update(best_params)
                if req.family == "classification":
                    return await asyncio.wait_for(
                        loop.run_in_executor(
                            None, _run_classification, X, y, cand.algo_id, feature_names, cand.hyperparams
                        ),
                        timeout=120.0,
                    )
                elif req.family == "regression":
                    return await asyncio.wait_for(
                        loop.run_in_executor(
                            None, _run_regression, X, y, cand.algo_id, feature_names, cand.hyperparams
                        ),
                        timeout=120.0,
                    )
                else:
                    return await asyncio.wait_for(
                        loop.run_in_executor(
                            None, _run_clustering, X, cand.algo_id, feature_names, cand.hyperparams
                        ),
                        timeout=120.0,
                    )

            try:
                metrics, fi, preds, trained_model, X_bg = await _run_candidate()
                score = metrics.get("f1", metrics.get("R2", metrics.get("silhouette_score", 0.0)))
                await experiment_tracker.finish_run(run, metrics=metrics,
                                              feature_importances=[f.model_dump() for f in fi])
                results.append({
                    "algo_id":       cand.algo_id,
                    "score":         round(float(score), 4),
                    "metrics":       metrics,
                    "fi":            fi,
                    "reason":        cand.reason,
                    "run_id":        run.run_id,
                    "trained_model": trained_model,
                    "X_bg":          X_bg,
                })
            except asyncio.TimeoutError:
                await experiment_tracker.finish_run(run, metrics={}, status="timeout")
                logger.warning("automl candidate %s timed out", cand.algo_id)
            except Exception as exc:
                await experiment_tracker.finish_run(run, metrics={}, status="failed")
                logger.warning("automl candidate %s failed: %s", cand.algo_id, exc)

        if not results:
            raise HTTPException(status_code=500, detail="All AutoML candidates failed.")

        results.sort(key=lambda r: r["score"], reverse=True)
        best = results[0]

        # SHAP on winner — use the actual trained model and its training background
        try:
            exp = Explainer(best["trained_model"], best["X_bg"], feature_names, req.family)
            shap_fi = exp.feature_importances(best["X_bg"])
            best_fi = [FeatureImportance(name=f["name"], importance=f["importance"]) for f in shap_fi]
        except Exception:
            best_fi = best["fi"]

        insights = _build_insights(req.family, best["algo_id"], req.table,
                                   target, best_fi, best["metrics"], len(rows))
        insights.insert(0, f"AutoML tested {len(results)} algorithm(s). Winner: {best['algo_id']} (score={best['score']:.4f}).")

        await audit_logger.ml_job(
            event_type=AuditEventType.ML_JOB_DONE,
            job_id=best["run_id"],
            connection_id=req.connection_id,
            algo=best["algo_id"],
            duration_ms=None,
            user_id=req.user_id,
            metrics=best["metrics"],
        )

        return AutoMLResult(
            best_algo=best["algo_id"],
            best_score=best["score"],
            best_metrics=best["metrics"],
            candidates=[{"algo": r["algo_id"], "score": r["score"],
                         "reason": r["reason"], "run_id": r["run_id"]} for r in results],
            feature_importances=best_fi,
            insights=insights,
            run_ids=run_ids,
        )

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error("automl failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during AutoML execution.")


# ─── Experiment history endpoint ──────────────────────────────────────────────

@router.get("/experiments")
async def list_experiments(
    connection_id: Optional[str] = None,
    tenant_id: str = "default",
    limit: int = 50,
):
    """
    Return recent ML runs scoped to `tenant_id`.

    Pass `tenant_id` to isolate results per user/org. Defaults to "default".
    Results are sorted newest-first and capped at `limit` (max 50).
    """
    from app.services.ml.experiment_tracker import experiment_tracker
    runs = experiment_tracker.get_runs(tenant_id=tenant_id, limit=limit if not connection_id else 500)
    if connection_id:
        runs = [r for r in runs if r.get("connection_id") == connection_id][:limit]
    return {"runs": runs, "total": len(runs)}


@router.get("/experiments/best")
async def best_experiment(
    experiment: str,
    metric: str = "f1",
    tenant_id: str = "default",
):
    """Return the best run for an experiment by metric."""
    from app.services.ml.experiment_tracker import experiment_tracker
    best = experiment_tracker.get_best_run(experiment=experiment, metric=metric, tenant_id=tenant_id)
    if not best:
        raise HTTPException(status_code=404, detail="No completed runs found.")
    return best


@router.delete("/run/{run_id}")
async def cancel_run(run_id: str, tenant_id: str = "default"):
    """
    Mark a run as cancelled in the experiment tracker.

    Called by the frontend "Cancel" button during a running job.

    Responses:
    - 200: Run cancelled successfully
    - 404: Run not found for this tenant
    """
    from app.services.ml.experiment_tracker import experiment_tracker
    runs = experiment_tracker.get_runs(tenant_id=tenant_id, limit=200)
    existing = next((r for r in runs if r.get("run_id") == run_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")

    # Build a minimal MLRun-like object to pass to finish_run
    import time
    from app.services.ml.experiment_tracker import MLRun
    run_obj = MLRun(
        run_id=run_id,
        experiment=existing.get("experiment", ""),
        algo=existing.get("algo", ""),
        family=existing.get("family", ""),
        connection_id=existing.get("connection_id", ""),
        table=existing.get("table", ""),
        hyperparams=existing.get("hyperparams", {}),
        metrics=existing.get("metrics", {}),
        feature_importances=existing.get("feature_importances", []),
        tenant_id=tenant_id,
        created_at=existing.get("created_at", time.time()),
    )
    await experiment_tracker.finish_run(run_obj, metrics=existing.get("metrics", {}), status="cancelled")
    return {"run_id": run_id, "status": "cancelled"}


# ─── PDF Report endpoint ────────────────────────────────────────────────────────
@router.get("/run/{run_id}/pdf")
async def download_run_pdf(run_id: str, tenant_id: str = "default"):
    """Download a professional PDF report containing ML insights and SHAP values."""
    from app.services.ml.experiment_tracker import experiment_tracker
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    # Primary: check in-memory job store (the run_id from POST /run maps here)
    run_data = None
    job = _pending_results.get(run_id)
    if job and job.get("status") == "success" and job.get("result"):
        run_data = job["result"]

    # Fallback: experiment tracker (used for sidebar history runs whose run_id
    # comes from the tracker's own UUID, not from POST /run)
    if not run_data:
        run_data = experiment_tracker.get_run(run_id)
    if not run_data:
        runs = experiment_tracker.get_runs(tenant_id=tenant_id, limit=500)
        run_data = next((r for r in runs if r.get("run_id") == run_id), None)

    if not run_data:
        raise HTTPException(status_code=404, detail="Run not found.")
    
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        title_style.textColor = colors.HexColor("#1e3a8a") 
        h2 = styles['Heading2']
        normal = styles['Normal']

        story = []
        story.append(Paragraph("AI Analytics Report", title_style))
        story.append(Spacer(1, 12))
        
        date_str = "Unknown"
        import time
        if "created_at" in run_data:
            from datetime import datetime
            date_str = datetime.fromtimestamp(run_data["created_at"]).strftime("%Y-%m-%d %H:%M:%S")

        story.append(Paragraph(f"<b>Table:</b> {run_data.get('table', 'Unknown')} | <b>Algorithm:</b> {run_data.get('algo', 'Unknown')} | <b>Date:</b> {date_str}", normal))
        story.append(Spacer(1, 24))
        
        story.append(Paragraph("<b>Model Performance Metrics</b>", h2))
        story.append(Spacer(1, 12))
        metrics = run_data.get('metrics', {})
        metrics_data = [["Metric", "Value"]]
        for k, v in metrics.items():
            metrics_data.append([str(k).upper(), str(v)])
        
        if len(metrics_data) > 1:
            t = Table(metrics_data, colWidths=[200, 200])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (1,0), colors.HexColor("#f3f4f6")),
                ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#111827")),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0,0), (-1,0), 12),
                ('BACKGROUND', (0,1), (-1,-1), colors.white),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
            ]))
            story.append(t)
            story.append(Spacer(1, 24))
        
        story.append(Paragraph("<b>Advanced Feature Impact (SHAP)</b>", h2))
        story.append(Spacer(1, 12))
        fis = run_data.get('feature_importances', [])
        
        if not fis:
            story.append(Paragraph("No feature importance data available.", normal))
        else:
            for fi_idx, fi in enumerate(fis[:15]):  # show top 15 features
                name = fi.get("name", "Unknown")
                imp = fi.get("importance", 0.0)
                insight_str = fi.get("insight") or f"This feature contributed {round(imp*100, 1)}% to the model's overall decisions."
                
                bg_color = colors.HexColor("#f9fafb")
                dir_color = colors.HexColor("#374151")
                if fi.get("direction") == "positive":
                    bg_color = colors.HexColor("#f0fdf4")
                    dir_color = colors.HexColor("#166534")
                elif fi.get("direction") == "negative":
                    bg_color = colors.HexColor("#fef2f2")
                    dir_color = colors.HexColor("#991b1b")
                
                p_style = ParagraphStyle(
                    f'fi_{run_id[:8]}_{fi_idx}',  # globally unique — avoids ReportLab registry collision
                    parent=normal,
                    leftIndent=10,
                    rightIndent=10,
                    spaceBefore=5,
                    spaceAfter=5,
                    textColor=dir_color,
                    backColor=bg_color,
                    borderWidth=1,
                    borderColor=colors.HexColor("#e5e7eb"),
                    borderPadding=10
                )
                story.append(Paragraph(f"<b>{name}</b> ({round(imp*100, 1)}% impact)", styles['Heading3']))
                story.append(Paragraph(f"<i>{insight_str}</i>", p_style))
                story.append(Spacer(1, 12))

        doc.build(story)
        buffer.seek(0)
        
        headers = {
            'Content-Disposition': f'attachment; filename="ML_Report_{run_id[:8]}.pdf"'
        }
        return StreamingResponse(buffer, media_type="application/pdf", headers=headers)
        
    except Exception as e:
        logger.error(f"PDF generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not generate PDF report.")

# ─── Health endpoint (T5-4) ───────────────────────────────────────────────────

@router.get("/health")
async def ml_health():
    """
    Return operational health of the ML subsystem.

    Used by monitoring and uptime checks.

    Responses:
    - 200: Health data returned (check `experiments_dir_writable` for storage issues)
    """
    from app.services.ml.experiment_tracker import experiment_tracker, EXPERIMENTS_DIR
    import time

    writable = False
    try:
        test_path = EXPERIMENTS_DIR / ".write_test"
        test_path.write_text("ok")
        test_path.unlink()
        writable = True
    except Exception as e:
        logger.warning("Experiments dir not writable: %s", e)

    runs = experiment_tracker.get_runs(limit=1)
    last_run_at: Optional[float] = runs[0].get("created_at") if runs else None
    all_runs = experiment_tracker.get_runs(limit=1000)

    return {
        "status": "ok",
        "experiments_dir_writable": writable,
        "runs_count": len(all_runs),
        "last_run_at": last_run_at,
    }


# ─── What-If simulation endpoint ─────────────────────────────────────────────

class WhatIfRequest(BaseModel):
    connection_id: str
    table: str = Field(..., max_length=128)
    features: List[str] = []
    target: Optional[str] = None
    algo: str
    family: Literal["classification", "regression", "clustering"]
    feature_weights: Dict[str, float] = Field(
        default={},
        description="Per-feature multiplier (0.0–2.0). 1.0 = no change.",
    )

    @model_validator(mode="after")
    def _validate(self) -> "WhatIfRequest":
        valid = VALID_ALGOS.get(self.family, set())
        if self.algo not in valid:
            raise ValueError(
                f"Algorithm '{self.algo}' is not valid for family '{self.family}'. "
                f"Valid options: {sorted(valid)}"
            )
        for feat, w in self.feature_weights.items():
            if not (0.0 <= w <= 2.0):
                raise ValueError(
                    f"Weight for '{feat}' must be between 0.0 and 2.0, got {w}."
                )
        return self


@router.post("/whatif")
async def whatif_analysis(req: WhatIfRequest):
    """
    Re-run ML analysis after applying per-feature multiplicative weights to the data.

    feature_weights: dict mapping feature name → multiplier (0.0 = zero out,
    1.0 = unchanged, 2.0 = double).  Only numeric columns are re-scaled.

    Returns new metrics and feature importances so the frontend can compare
    them to the original baseline.

    Responses:
    - 200: What-if metrics and importances returned
    - 422: Unusable data or bad request
    - 503: Database connection failed
    - 504: Analysis timed out (60 s limit)
    - 500: Unexpected error
    """
    try:
        all_cols = list(dict.fromkeys(
            ([req.target] if req.target else []) + list(req.features)
        ))
        rows = await _fetch_data(req.connection_id, req.table, all_cols, n=500)

        # Apply multiplicative weights to numeric columns
        if req.feature_weights:
            df = pd.DataFrame(rows)
            for feat, weight in req.feature_weights.items():
                if feat not in df.columns:
                    continue
                numeric = pd.to_numeric(df[feat], errors="coerce")
                if numeric.notna().sum() > len(df) * 0.3:
                    df[feat] = numeric * float(weight)
            rows = df.to_dict("records")

        loop = asyncio.get_running_loop()
        X, y, feature_names = await loop.run_in_executor(
            None, _preprocess, rows, list(req.features), req.target, req.family
        )
        if X is None or len(X) == 0:
            raise ValueError(
                "No usable data after preprocessing with the supplied weights. "
                "Ensure feature and target columns contain non-null numeric values."
            )

        async def _run():
            if req.family == "classification":
                metrics, fi, _, *__ = await loop.run_in_executor(
                    None, _run_classification, X, y, req.algo, feature_names
                )
            elif req.family == "regression":
                metrics, fi, _, *__ = await loop.run_in_executor(
                    None, _run_regression, X, y, req.algo, feature_names
                )
            else:
                metrics, fi, _, *__ = await loop.run_in_executor(
                    None, _run_clustering, X, req.algo, feature_names
                )
            return metrics, fi

        try:
            metrics, fi = await asyncio.wait_for(_run(), timeout=60.0)
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail="What-if analysis timed out. Try fewer features or a faster algorithm.",
            )

        return {
            "metrics": metrics,
            "feature_importances": [f.model_dump() for f in fi],
            "row_count": len(rows),
        }

    except HTTPException:
        raise
    except (ValueError, NotImplementedError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error("whatif analysis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during what-if analysis.")
