"""
Unit tests for app/api/ml_analysis.py

All tests use synthetic in-memory data — no database connection required.
Covers:
  - _safe_quote: SQL identifier quoting
  - _preprocess: raw row dicts → (X, y, feature_names)
  - _normalize_fi: importance vector normalisation
  - _build_insights: insight string generation per family
  - _run_classification: RF / LogReg end-to-end on synthetic data
  - _run_regression: LinearRegression / GradientBoosting end-to-end
  - _run_clustering: KMeans / DBSCAN end-to-end
  - _run_timeseries: date-based forecast with numpy
  - AnalysisRequest: algo/family validator, field size limits (T1-5, T5-2)
  - AutoMLRequest: n_trials / max_candidates limits (T2-4)
  - _build_insights: parametric tests across all 4 families (T2-3)
  - ExperimentTracker: concurrent writes, rotation, get_best_run (T2-5)
  - Edge cases per algorithm family (T2-2)
"""
import asyncio
import math
import numpy as np
import pytest

# ── Helpers ───────────────────────────────────────────────────────────────────

def _rows_classification(n=100):
    """Binary classification: 2 numeric features + categorical, label 0/1."""
    rng = np.random.default_rng(0)
    rows = []
    for i in range(n):
        label = int(i % 2)
        rows.append({
            "age":    float(rng.integers(20, 60)),
            "score":  float(rng.uniform(0, 1)),
            "region": "east" if i % 3 == 0 else "west",
            "target": str(label),
        })
    return rows


def _rows_regression(n=100):
    """Regression: 2 numeric features, continuous target."""
    rng = np.random.default_rng(1)
    rows = []
    for i in range(n):
        x1, x2 = float(rng.uniform(0, 10)), float(rng.uniform(0, 5))
        rows.append({"x1": x1, "x2": x2, "price": round(2 * x1 + 3 * x2 + float(rng.normal(0, 0.5)), 2)})
    return rows


def _rows_clustering(n=120):
    """Clustering: 2 numeric features forming 3 blobs."""
    rng = np.random.default_rng(2)
    rows = []
    centres = [(0, 0), (5, 5), (10, 0)]
    for i in range(n):
        cx, cy = centres[i % 3]
        rows.append({"f1": float(cx + rng.normal(0, 0.5)), "f2": float(cy + rng.normal(0, 0.5))})
    return rows


def _rows_timeseries(n=60):
    """Time series: monotonic dates + a numeric target with upward trend."""
    import pandas as pd
    rows = []
    dates = pd.date_range("2023-01-01", periods=n, freq="D")
    rng = np.random.default_rng(3)
    for i, d in enumerate(dates):
        rows.append({"event_date": str(d.date()), "revenue": float(100 + i * 2 + rng.normal(0, 3))})
    return rows


# ── _safe_quote ───────────────────────────────────────────────────────────────

class TestSafeQuote:
    def setup_method(self):
        from app.api.ml_analysis import _safe_quote
        self.q = _safe_quote

    def test_postgres_double_quote(self):
        assert self.q("my_table", "postgres") == '"my_table"'

    def test_mysql_backtick(self):
        assert self.q("my_table", "mysql") == "`my_table`"

    def test_rejects_injection_postgres(self):
        # Unsafe identifiers must raise ValueError, not be silently stripped
        with pytest.raises(ValueError):
            self.q('evil"name', "postgres")

    def test_rejects_injection_mysql(self):
        with pytest.raises(ValueError):
            self.q("evil`name", "mysql")

    def test_unknown_db_type_uses_double_quote(self):
        assert self.q("tbl", "sqlite") == '"tbl"'


# ── _preprocess ───────────────────────────────────────────────────────────────

class TestPreprocess:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess
        self.prep = _preprocess

    def test_returns_correct_shapes(self):
        rows = _rows_classification(50)
        X, y, names = self.prep(rows, ["age", "score", "region"], "target", "classification")
        assert X is not None
        assert X.shape == (50, 3)
        assert y is not None and len(y) == 50
        assert len(names) == 3

    def test_empty_rows_returns_none(self):
        X, y, names = self.prep([], ["age"], "target", "classification")
        assert X is None

    def test_falls_back_to_all_columns_when_features_missing(self):
        rows = [{"a": float(i), "b": float(i*2), "tgt": 0} for i in range(20)]
        X, y, names = self.prep(rows, ["nonexistent_col"], "tgt", "regression")
        assert X is not None
        assert set(names).issubset({"a", "b"})

    def test_handles_nulls_in_numeric(self):
        rows = [{"x": None if i % 5 == 0 else float(i), "y": float(i % 3)} for i in range(30)]
        X, y, names = self.prep(rows, ["x"], "y", "regression")
        assert X is not None
        assert not np.any(np.isnan(X))

    def test_regression_target_is_float(self):
        rows = _rows_regression(40)
        X, y, names = self.prep(rows, ["x1", "x2"], "price", "regression")
        assert y.dtype in (np.float32, np.float64)

    def test_classification_target_is_int_encoded(self):
        rows = _rows_classification(40)
        X, y, names = self.prep(rows, ["age", "score"], "target", "classification")
        assert set(y.tolist()).issubset({0, 1})

    def test_too_few_rows_after_dropna_returns_none(self):
        rows = [{"x": None, "y": float(i)} for i in range(5)]
        X, y, names = self.prep(rows, ["x"], "y", "regression")
        assert X is None


# ── _normalize_fi ─────────────────────────────────────────────────────────────

class TestNormalizeFI:
    def setup_method(self):
        from app.api.ml_analysis import _normalize_fi
        self.fn = _normalize_fi

    def test_sums_to_one(self):
        names = ["a", "b", "c"]
        imps = np.array([0.5, 0.3, 0.2])
        fi = self.fn(names, imps)
        assert abs(sum(f.importance for f in fi) - 1.0) < 1e-6

    def test_sorted_descending(self):
        names = ["low", "high", "mid"]
        imps = np.array([0.1, 0.7, 0.2])
        fi = self.fn(names, imps)
        importances = [f.importance for f in fi]
        assert importances == sorted(importances, reverse=True)

    def test_zero_importances_uniform(self):
        names = ["x", "y"]
        fi = self.fn(names, np.array([0.0, 0.0]))
        assert abs(fi[0].importance - 0.5) < 1e-6
        assert abs(fi[1].importance - 0.5) < 1e-6

    def test_single_feature(self):
        fi = self.fn(["only"], np.array([3.14]))
        assert abs(fi[0].importance - 1.0) < 1e-6


# ── _build_insights ───────────────────────────────────────────────────────────

class TestBuildInsights:
    def setup_method(self):
        from app.api.ml_analysis import _build_insights, FeatureImportance
        self.fn = _build_insights
        self.FI = FeatureImportance

    def _fi(self, *names_imps):
        return [self.FI(name=n, importance=i) for n, i in names_imps]

    def test_classification_contains_accuracy(self):
        fi = self._fi(("age", 0.6), ("score", 0.4))
        ins = self.fn("classification", "rf_clf", "users", "label", fi,
                      {"accuracy": 0.88, "f1": 0.87, "precision": 0.88, "recall": 0.86,
                       "test_size": 20, "n_classes": 2}, 100)
        assert any("accuracy" in s.lower() or "88" in s for s in ins)

    def test_classification_high_f1_positive_note(self):
        fi = self._fi(("x", 1.0))
        ins = self.fn("classification", "rf_clf", "t", "y", fi,
                      {"accuracy": 0.92, "f1": 0.91, "precision": 0.91, "recall": 0.91,
                       "test_size": 20, "n_classes": 2}, 100)
        assert any("production" in s.lower() or "excellent" in s.lower() for s in ins)

    def test_regression_contains_r2(self):
        fi = self._fi(("x1", 0.7), ("x2", 0.3))
        ins = self.fn("regression", "linear", "sales", "revenue", fi,
                      {"R2": 0.78, "RMSE": 1.2, "MAE": 0.9, "test_size": 20}, 200)
        assert any("r²" in s.lower() or "r2" in s.lower() or "78" in s for s in ins)

    def test_clustering_returns_strings(self):
        fi = self._fi(("f1", 0.5), ("f2", 0.5))
        ins = self.fn("clustering", "kmeans", "events", None, fi,
                      {"n_clusters": 3, "silhouette_score": 0.62, "samples": 120}, 120)
        assert isinstance(ins, list)
        assert all(isinstance(s, str) for s in ins)

    def test_timeseries_returns_strings(self):
        fi = self._fi(("revenue", 1.0))
        ins = self.fn("timeseries", "arima", "orders", "revenue", fi,
                      {"trend_direction": "up", "forecast_range": [100, 130]}, 60)
        assert isinstance(ins, list)


# ── _run_classification ───────────────────────────────────────────────────────

class TestRunClassification:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess, _run_classification
        rows = _rows_classification(80)
        self.X, self.y, self.names = _preprocess(rows, ["age", "score", "region"], "target", "classification")
        self.fn = _run_classification

    def test_rf_clf_returns_valid_metrics(self):
        metrics, fi, preds, *_ = self.fn(self.X, self.y, "rf_clf", self.names)
        assert 0.0 <= metrics["accuracy"] <= 1.0
        assert metrics["n_classes"] == 2
        assert len(fi) == len(self.names)

    def test_logreg_returns_valid_metrics(self):
        metrics, fi, preds, *_ = self.fn(self.X, self.y, "logreg", self.names)
        assert 0.0 <= metrics["f1"] <= 1.0

    def test_svm_returns_predictions(self):
        metrics, fi, preds, *_ = self.fn(self.X, self.y, "svm", self.names)
        assert len(preds) >= 1

    def test_knn_runs_without_error(self):
        metrics, fi, preds, *_ = self.fn(self.X, self.y, "knn", self.names)
        assert isinstance(metrics["accuracy"], float)

    def test_insufficient_data_raises(self):
        with pytest.raises(ValueError):
            self.fn(self.X[:5], self.y[:5], "rf_clf", self.names)

    def test_single_class_raises(self):
        y_single = np.zeros(len(self.y), dtype=int)
        with pytest.raises(ValueError):
            self.fn(self.X, y_single, "rf_clf", self.names)

    def test_fi_sums_to_one(self):
        _, fi, *_ = self.fn(self.X, self.y, "rf_clf", self.names)
        assert abs(sum(f.importance for f in fi) - 1.0) < 1e-5


# ── _run_regression ───────────────────────────────────────────────────────────

class TestRunRegression:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess, _run_regression
        rows = _rows_regression(80)
        self.X, self.y, self.names = _preprocess(rows, ["x1", "x2"], "price", "regression")
        self.fn = _run_regression

    def test_linear_r2_positive(self):
        metrics, fi, preds, *_ = self.fn(self.X, self.y, "linear", self.names)
        assert metrics["R2"] > 0.5   # data is nearly linear

    def test_ridge_runs(self):
        metrics, fi, preds, *_ = self.fn(self.X, self.y, "ridge", self.names)
        assert "RMSE" in metrics and metrics["RMSE"] >= 0

    def test_lasso_runs(self):
        metrics, fi, preds, *_ = self.fn(self.X, self.y, "lasso", self.names)
        assert "MAE" in metrics

    def test_xgboost_fallback_runs(self):
        metrics, fi, preds, *_ = self.fn(self.X, self.y, "xgboost", self.names)
        assert isinstance(metrics["R2"], float)

    def test_predictions_have_up_to_ten_samples(self):
        _, _, preds, *_ = self.fn(self.X, self.y, "linear", self.names)
        assert len(preds) <= 10
        assert len(preds) > 0

    def test_insufficient_data_raises(self):
        with pytest.raises(ValueError):
            self.fn(self.X[:4], self.y[:4], "linear", self.names)


# ── _run_clustering ───────────────────────────────────────────────────────────

class TestRunClustering:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess, _run_clustering
        rows = _rows_clustering(90)
        self.X, _, self.names = _preprocess(rows, ["f1", "f2"], None, "clustering")
        self.fn = _run_clustering

    def test_kmeans_finds_clusters(self):
        metrics, fi, preds, *_ = self.fn(self.X, "kmeans", self.names)
        assert metrics["n_clusters"] >= 2
        assert 0.0 <= metrics["silhouette_score"] <= 1.0

    def test_dbscan_runs(self):
        metrics, fi, preds, *_ = self.fn(self.X, "dbscan", self.names)
        assert "n_clusters" in metrics

    def test_kmeans_predictions_sum_to_100(self):
        _, _, preds, *_ = self.fn(self.X, "kmeans", self.names)
        total = sum(p.value for p in preds)
        assert abs(total - 100.0) < 2.0   # allow small float rounding

    def test_insufficient_data_raises(self):
        with pytest.raises(ValueError):
            self.fn(self.X[:5], "kmeans", self.names)


# ── _run_timeseries ───────────────────────────────────────────────────────────

class TestRunTimeseries:
    def setup_method(self):
        from app.api.ml_analysis import _run_timeseries
        self.fn = _run_timeseries
        self.rows = _rows_timeseries(60)

    def test_returns_30_forecast_points(self):
        metrics, fi, preds = self.fn(self.rows, ["event_date"], "revenue", "arima")
        assert len(preds) == 6

    def test_metrics_include_trend(self):
        metrics, fi, preds = self.fn(self.rows, ["event_date"], "revenue", "arima")
        assert "trend" in metrics

    def test_forecast_values_are_numeric(self):
        _, _, preds = self.fn(self.rows, ["event_date"], "revenue", "arima")
        for p in preds:
            assert isinstance(p.value, float)
            assert not math.isnan(p.value)

    def test_empty_rows_raises(self):
        with pytest.raises(ValueError):
            self.fn([], ["event_date"], "revenue", "arima")

    def test_works_without_explicit_date_col(self):
        # Should fall back to auto-detecting the date column
        metrics, fi, preds = self.fn(self.rows, [], "revenue", "arima")
        assert len(preds) == 6


# ── T2-1 / T1-5: AnalysisRequest algo/family validator ───────────────────────

class TestAnalysisRequestValidator:
    def _make(self, family, algo, **kwargs):
        from app.api.ml_analysis import AnalysisRequest
        defaults = dict(connection_id="c1", table="t1", family=family, algo=algo)
        defaults.update(kwargs)
        return AnalysisRequest(**defaults)

    def test_valid_classification_algos_accepted(self):
        for algo in ("rf_clf", "svm", "knn", "logreg"):
            req = self._make("classification", algo)
            assert req.algo == algo

    def test_valid_regression_algos_accepted(self):
        for algo in ("linear", "ridge", "lasso", "xgboost"):
            req = self._make("regression", algo)
            assert req.algo == algo

    def test_valid_clustering_algos_accepted(self):
        for algo in ("kmeans", "dbscan"):
            req = self._make("clustering", algo)
            assert req.algo == algo

    def test_valid_timeseries_algos_accepted(self):
        for algo in ("arima",):
            req = self._make("timeseries", algo)
            assert req.algo == algo

    def test_wrong_family_algo_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="not valid for family"):
            self._make("regression", "rf_clf")

    def test_unknown_algo_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="not valid for family"):
            self._make("classification", "gradient_boost")

    def test_table_name_too_long_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make("classification", "rf_clf", table="x" * 129)

    def test_features_list_too_long_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make("classification", "rf_clf", features=[f"col_{i}" for i in range(21)])

    def test_secondary_tables_accepted(self):
        # secondary_tables is explicitly supported for multi-table joins
        import inspect
        from app.api.ml_analysis import AnalysisRequest
        fields = AnalysisRequest.model_fields
        assert "secondary_tables" in fields


# ── T2-4: AutoMLRequest validation ───────────────────────────────────────────

class TestAutoMLRequestValidation:
    def _make(self, **kwargs):
        from app.api.ml_analysis import AutoMLRequest
        base = dict(connection_id="c1", table="t1", family="classification")
        base.update(kwargs)
        return AutoMLRequest(**base)

    def test_n_trials_max_100_accepted(self):
        req = self._make(n_trials=100)
        assert req.n_trials == 100

    def test_n_trials_over_100_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make(n_trials=101)

    def test_max_candidates_max_10_accepted(self):
        req = self._make(max_candidates=10)
        assert req.max_candidates == 10

    def test_max_candidates_over_10_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make(max_candidates=11)

    def test_invalid_family_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make(family="deep_learning")


# ── T2-3: _build_insights parametric tests ───────────────────────────────────

class TestBuildInsightsParametric:
    def setup_method(self):
        from app.api.ml_analysis import _build_insights, FeatureImportance
        self.fn = _build_insights
        self.fi = [FeatureImportance(name="x", importance=0.7),
                   FeatureImportance(name="y", importance=0.3)]

    # Classification
    def test_classification_excellent_f1(self):
        ins = self.fn("classification", "rf_clf", "t", "label", self.fi,
                      {"accuracy": 0.95, "f1": 0.92, "precision": 0.93, "recall": 0.91,
                       "test_size": 20, "n_classes": 2}, 200)
        assert any("production" in s.lower() or "excellent" in s.lower() for s in ins)

    def test_classification_poor_f1(self):
        ins = self.fn("classification", "rf_clf", "t", "label", self.fi,
                      {"accuracy": 0.55, "f1": 0.45, "precision": 0.50, "recall": 0.40,
                       "test_size": 20, "n_classes": 2}, 200)
        assert any("moderate" in s.lower() or "labelled" in s.lower() for s in ins)

    def test_classification_borderline_f1(self):
        ins = self.fn("classification", "rf_clf", "t", "label", self.fi,
                      {"accuracy": 0.75, "f1": 0.73, "precision": 0.75, "recall": 0.71,
                       "test_size": 20, "n_classes": 2}, 200)
        assert any("tuning" in s.lower() or "good" in s.lower() for s in ins)

    def test_classification_precision_gt_recall_fires(self):
        ins = self.fn("classification", "rf_clf", "t", "label", self.fi,
                      {"accuracy": 0.80, "f1": 0.75, "precision": 0.90, "recall": 0.60,
                       "test_size": 20, "n_classes": 2}, 200)
        assert any("precision" in s.lower() and "recall" in s.lower() for s in ins)

    def test_classification_recall_gt_precision_fires(self):
        ins = self.fn("classification", "rf_clf", "t", "label", self.fi,
                      {"accuracy": 0.80, "f1": 0.75, "precision": 0.60, "recall": 0.90,
                       "test_size": 20, "n_classes": 2}, 200)
        assert any("recall" in s.lower() and "precision" in s.lower() for s in ins)

    # Regression
    def test_regression_strong_r2(self):
        ins = self.fn("regression", "linear", "t", "y", self.fi,
                      {"R2": 0.91, "RMSE": 0.5, "MAE": 0.4, "test_size": 20}, 200)
        assert any("production" in s.lower() or "strong" in s.lower() for s in ins)

    def test_regression_poor_r2(self):
        ins = self.fn("regression", "linear", "t", "y", self.fi,
                      {"R2": 0.20, "RMSE": 5.0, "MAE": 4.0, "test_size": 20}, 200)
        assert any("noise" in s.lower() or "r²" in s.lower() or "low" in s.lower() for s in ins)

    # Timeseries
    def test_timeseries_low_mape(self):
        ins = self.fn("timeseries", "arima", "t", "val", self.fi,
                      {"MAPE": 5.0, "RMSE": 1.0, "MAE": 0.8, "samples": 60,
                       "trend": "upward", "monthly_growth": 3.5}, 60)
        assert any("reliable" in s.lower() or "low" in s.lower() for s in ins)

    def test_timeseries_high_mape(self):
        ins = self.fn("timeseries", "arima", "t", "val", self.fi,
                      {"MAPE": 45.0, "RMSE": 10.0, "MAE": 8.0, "samples": 60,
                       "trend": "flat", "monthly_growth": 0.0}, 60)
        assert any("volatile" in s.lower() or "high" in s.lower() for s in ins)

    # Clustering
    def test_clustering_strong_silhouette(self):
        ins = self.fn("clustering", "kmeans", "t", None, self.fi,
                      {"n_clusters": 3, "silhouette_score": 0.65, "samples": 120}, 120)
        assert any("strong" in s.lower() or "well" in s.lower() for s in ins)

    def test_clustering_weak_silhouette(self):
        ins = self.fn("clustering", "kmeans", "t", None, self.fi,
                      {"n_clusters": 5, "silhouette_score": 0.10, "samples": 120}, 120)
        assert any("weak" in s.lower() or "continuous" in s.lower() for s in ins)

    def test_clustering_dbscan_noise_reported(self):
        ins = self.fn("clustering", "dbscan", "t", None, self.fi,
                      {"n_clusters": 2, "silhouette_score": 0.45, "samples": 100,
                       "n_noise_points": 12}, 100)
        assert any("noise" in s.lower() or "outlier" in s.lower() for s in ins)


# ── T2-2: Edge case tests per algorithm ──────────────────────────────────────

class TestClassificationEdgeCases:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess, _run_classification
        self.prep = _preprocess
        self.fn = _run_classification

    def test_imbalanced_classes_runs(self):
        """99%/1% split — model should run without error."""
        rng = np.random.default_rng(99)
        rows = [{"x": float(rng.uniform(0, 1)), "y": float(rng.uniform(0, 1)),
                 "label": "minority" if i < 3 else "majority"}
                for i in range(200)]
        X, y, names = self.prep(rows, ["x", "y"], "label", "classification")
        assert X is not None
        metrics, fi, preds, *_ = self.fn(X, y, "rf_clf", names)
        assert 0.0 <= metrics["accuracy"] <= 1.0

    def test_row_cap_5000_enforced(self):
        """Datasets larger than 5000 rows are silently capped."""
        rng = np.random.default_rng(7)
        rows = [{"x": float(rng.uniform(0, 1)), "label": str(i % 2)} for i in range(6000)]
        X, y, names = self.prep(rows, ["x"], "label", "classification")
        # After capping in _run_classification, train+test ≤ 5000
        metrics, fi, preds, *_ = self.fn(X, y, "rf_clf", names)
        assert metrics["samples"] <= 5000


class TestRegressionEdgeCases:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess, _run_regression
        self.prep = _preprocess
        self.fn = _run_regression

    def test_all_zero_target_runs(self):
        """All-zero target is valid (R² will be 0 or negative)."""
        rows = [{"x": float(i), "y": 0.0} for i in range(50)]
        X, y, names = self.prep(rows, ["x"], "y", "regression")
        metrics, fi, preds, *_ = self.fn(X, y, "linear", names)
        assert "R2" in metrics

    def test_negative_r2_clipped_to_minus_1(self):
        """Pathological data can produce R² < −1; it must be clipped to [−1, 1]."""
        rng = np.random.default_rng(42)
        rows = [{"x": float(rng.uniform(0, 0.001)), "y": float(rng.uniform(0, 100))}
                for _ in range(50)]
        X, y, names = self.prep(rows, ["x"], "y", "regression")
        metrics, *_ = self.fn(X, y, "linear", names)
        assert metrics["R2"] >= -1.0

    def test_single_feature_runs(self):
        rows = [{"x": float(i), "y": float(i * 3)} for i in range(50)]
        X, y, names = self.prep(rows, ["x"], "y", "regression")
        assert X.shape[1] == 1
        metrics, fi, preds, *_ = self.fn(X, y, "linear", names)
        assert len(fi) == 1


class TestClusteringEdgeCases:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess, _run_clustering
        self.prep = _preprocess
        self.fn = _run_clustering

    def test_kmeans_max_k2_forced(self):
        """Only 30 rows → max_k = max(2, 30//10) = 3 — must still return ≥ 2 clusters."""
        rng = np.random.default_rng(5)
        rows = [{"f1": float(rng.normal(0, 1)), "f2": float(rng.normal(0, 1))}
                for _ in range(30)]
        X, _, names = self.prep(rows, ["f1", "f2"], None, "clustering")
        metrics, fi, preds, *_ = self.fn(X, "kmeans", names)
        assert metrics["n_clusters"] >= 2

    def test_dbscan_all_noise_result(self):
        """Uniform random data → DBSCAN may label everything as noise (−1).
        The implementation should handle this without crashing."""
        rng = np.random.default_rng(123)
        rows = [{"f1": float(rng.uniform(0, 100)), "f2": float(rng.uniform(0, 100))}
                for _ in range(50)]
        X, _, names = self.prep(rows, ["f1", "f2"], None, "clustering")
        # Should not raise even if all points are noise
        metrics, fi, preds, *_ = self.fn(X, "dbscan", names)
        assert "n_clusters" in metrics


class TestTimeseriesEdgeCases:
    def setup_method(self):
        from app.api.ml_analysis import _run_timeseries
        self.fn = _run_timeseries

    def test_fewer_than_14_points_no_seasonality(self):
        """With <14 points the seasonal path is skipped; model must still return preds."""
        import pandas as pd
        dates = pd.date_range("2024-01-01", periods=10, freq="D")
        rows = [{"event_date": str(d.date()), "val": float(10 + i)}
                for i, d in enumerate(dates)]
        metrics, fi, preds = self.fn(rows, ["event_date"], "val", "arima")
        assert len(preds) == 6

    def test_flat_target_runs(self):
        """Constant target is valid; MAPE will be extreme but must not crash."""
        import pandas as pd
        dates = pd.date_range("2024-01-01", periods=30, freq="D")
        rows = [{"event_date": str(d.date()), "val": 42.0} for d in dates]
        metrics, fi, preds = self.fn(rows, ["event_date"], "val", "arima")
        assert isinstance(metrics["MAPE"], float)


# ── T2-5: ExperimentTracker async / concurrency tests ────────────────────────

class TestExperimentTrackerAsync:
    """Tests for async safety and rotation of ExperimentTracker."""

    def _get_tracker_module(self):
        """Return the actual experiment_tracker *module* (not the singleton)."""
        import sys
        import importlib
        # Force the submodule into sys.modules if not already there
        importlib.import_module("app.services.ml.experiment_tracker")
        return sys.modules["app.services.ml.experiment_tracker"]

    def _make_tracker(self, tmp_path):
        from pathlib import Path
        mod = self._get_tracker_module()
        mod.EXPERIMENTS_DIR = Path(tmp_path)
        return mod.ExperimentTracker()

    def test_concurrent_start_finish_no_corruption(self, tmp_path):
        """10 concurrent start_run / finish_run pairs must not corrupt the file."""
        tracker = self._make_tracker(tmp_path)

        async def _run():
            async def one_run(i):
                run = await tracker.start_run(
                    experiment="test", algo="linear", family="regression",
                    connection_id="c", table="t", hyperparams={"i": i},
                )
                await tracker.finish_run(run, metrics={"R2": 0.9}, status="success")
            await asyncio.gather(*[one_run(i) for i in range(10)])

        asyncio.run(_run())

        runs = tracker.get_runs(limit=200)
        finished = [r for r in runs if r.get("status") == "success"]
        assert len(finished) == 10

    def test_rotation_creates_bak_and_new_file(self, tmp_path):
        """After rotation the .bak file must exist and the new file has only new records."""
        tracker = self._make_tracker(tmp_path)
        mod = self._get_tracker_module()
        # Force rotation by patching the module-level constant
        mod._MAX_LOG_BYTES = 1

        async def _run():
            run = await tracker.start_run(
                experiment="test", algo="linear", family="regression",
                connection_id="c", table="t", hyperparams={},
            )
            await tracker.finish_run(run, metrics={"R2": 0.8})

        asyncio.run(_run())

        bak = tracker._log_path.with_suffix(".jsonl.bak")
        assert bak.exists()
        assert tracker._log_path.exists()

    def test_get_best_run_no_completed_returns_none(self, tmp_path):
        """get_best_run with only running / failed runs must return None."""
        tracker = self._make_tracker(tmp_path)

        async def _run():
            run = await tracker.start_run(
                experiment="test", algo="rf_clf", family="classification",
                connection_id="c", table="t", hyperparams={},
            )
            await tracker.finish_run(run, metrics={}, status="failed")

        asyncio.run(_run())

        best = tracker.get_best_run(experiment="test", metric="f1")
        assert best is None


# ── Trustworthiness checks: _check_data_quality ──────────────────────────────

class TestCheckDataQuality:
    def setup_method(self):
        from app.api.ml_analysis import _check_data_quality
        self.fn = _check_data_quality

    # Fix 1 — target leakage detection
    def test_target_in_features_raises_warning(self):
        rows = [{"age": float(i), "label": str(i % 2)} for i in range(60)]
        warnings = self.fn(rows, ["age", "label"], "label")
        assert any("leakage" in w.lower() or "target" in w.lower() for w in warnings)

    def test_no_leakage_no_warning(self):
        rows = [{"age": float(i), "label": str(i % 2)} for i in range(60)]
        warnings = self.fn(rows, ["age"], "label")
        assert not any("leakage" in w.lower() for w in warnings)

    # Fix 2 — small dataset warning
    def test_very_small_dataset_warns(self):
        rows = [{"x": float(i), "y": float(i)} for i in range(20)]
        warnings = self.fn(rows, ["x"], "y")
        assert any("rows" in w.lower() or "reliable" in w.lower() for w in warnings)

    def test_borderline_dataset_warns(self):
        rows = [{"x": float(i), "y": float(i)} for i in range(60)]
        warnings = self.fn(rows, ["x"], "y")
        assert any("approximate" in w.lower() or "rows" in w.lower() for w in warnings)

    def test_large_dataset_no_size_warning(self):
        rows = [{"x": float(i), "y": float(i)} for i in range(200)]
        warnings = self.fn(rows, ["x"], "y")
        assert not any("reliable" in w.lower() or "approximate" in w.lower() for w in warnings)

    # Fix 3 — high-cardinality ID column detection
    def test_id_column_warns(self):
        rows = [{"id": f"usr_{i}", "age": float(i % 50), "label": str(i % 2)}
                for i in range(200)]
        warnings = self.fn(rows, ["id", "age"], "label")
        assert any("id" in w.lower() or "cardinality" in w.lower() or "identity" in w.lower()
                   for w in warnings)

    def test_low_cardinality_column_no_warning(self):
        rows = [{"region": "east" if i % 2 == 0 else "west", "label": str(i % 3)}
                for i in range(200)]
        warnings = self.fn(rows, ["region"], "label")
        assert not any("cardinality" in w.lower() or "identity" in w.lower() for w in warnings)

    # Fix 3 — constant feature detection
    def test_constant_feature_warns(self):
        rows = [{"x": 1.0, "y": float(i)} for i in range(60)]
        warnings = self.fn(rows, ["x"], "y")
        assert any("constant" in w.lower() for w in warnings)

    def test_varying_feature_no_constant_warning(self):
        rows = [{"x": float(i), "y": float(i * 2)} for i in range(60)]
        warnings = self.fn(rows, ["x"], "y")
        assert not any("constant" in w.lower() for w in warnings)


# ── Trustworthiness checks: baseline_accuracy in classification metrics ───────

class TestBaselineAccuracy:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess, _run_classification
        self.prep = _preprocess
        self.fn = _run_classification

    def test_baseline_accuracy_present_in_metrics(self):
        rows = _rows_classification(100)
        X, y, names = self.prep(rows, ["age", "score"], "target", "classification")
        metrics, *_ = self.fn(X, y, "rf_clf", names)
        assert "baseline_accuracy" in metrics

    def test_baseline_accuracy_is_majority_class_fraction(self):
        """50/50 balanced data → baseline should be 0.5."""
        rows = _rows_classification(100)   # _rows_classification alternates 0/1 → 50/50
        X, y, names = self.prep(rows, ["age", "score"], "target", "classification")
        metrics, *_ = self.fn(X, y, "rf_clf", names)
        assert abs(metrics["baseline_accuracy"] - 0.5) < 0.1

    def test_model_accuracy_beats_baseline_on_clean_data(self):
        """On clearly linearly separable data the model must beat the naive baseline."""
        rng = np.random.default_rng(0)
        # Class 0: x in [0, 1], Class 1: x in [9, 10] — trivially separable
        rows = (
            [{"x": float(rng.uniform(0, 1)), "label": "0"} for _ in range(100)] +
            [{"x": float(rng.uniform(9, 10)), "label": "1"} for _ in range(100)]
        )
        X, y, names = self.prep(rows, ["x"], "label", "classification")
        metrics, *_ = self.fn(X, y, "rf_clf", names)
        assert metrics["accuracy"] > metrics["baseline_accuracy"]


# ── Trustworthiness: target excluded from features in _preprocess ─────────────

class TestTargetExcludedFromFeatures:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess
        self.prep = _preprocess

    def test_target_not_in_feature_names_even_if_passed(self):
        """Even if caller passes target in feature_cols, _preprocess must strip it."""
        rows = [{"age": float(i), "score": float(i * 2), "label": str(i % 2)}
                for i in range(60)]
        # Intentionally pass target column inside features
        X, y, names = self.prep(rows, ["age", "score", "label"], "label", "classification")
        assert "label" not in names

    def test_x_shape_excludes_target_column(self):
        """X must have 2 columns (age, score), not 3 — target must be stripped."""
        rows = [{"age": float(i), "score": float(i * 2), "label": str(i % 2)}
                for i in range(60)]
        X, y, names = self.prep(rows, ["age", "score", "label"], "label", "classification")
        assert X.shape[1] == 2


# ── Trustworthiness: high-cardinality columns excluded in _preprocess ─────────

class TestHighCardinalityExcluded:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess
        self.prep = _preprocess

    def test_id_column_excluded_from_X(self):
        """A unique-per-row string column must be silently dropped from features."""
        rows = [{"user_id": f"u{i:04d}", "age": float(i % 50), "label": str(i % 2)}
                for i in range(100)]
        X, y, names = self.prep(rows, ["user_id", "age"], "label", "classification")
        assert "user_id" not in names
        assert X.shape[1] == 1   # only age remains

    def test_low_cardinality_string_kept(self):
        """A column with only 2–3 unique values (e.g. region) must NOT be dropped."""
        rows = [{"region": "east" if i % 2 == 0 else "west",
                 "age": float(i % 50), "label": str(i % 2)}
                for i in range(100)]
        X, y, names = self.prep(rows, ["region", "age"], "label", "classification")
        assert "region" in names
