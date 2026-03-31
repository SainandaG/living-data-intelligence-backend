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
"""
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

    def test_strips_injection_postgres(self):
        # A double-quote in the name must be removed, not passed through
        result = self.q('evil"name', "postgres")
        assert '"' not in result[1:-1]

    def test_strips_injection_mysql(self):
        result = self.q("evil`name", "mysql")
        assert "`" not in result[1:-1]

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
        rows = [{"a": 1.0, "b": 2.0, "tgt": 0} for _ in range(20)]
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
        metrics, fi, preds = self.fn(self.X, self.y, "rf_clf", self.names)
        assert 0.0 <= metrics["accuracy"] <= 1.0
        assert metrics["n_classes"] == 2
        assert len(fi) == len(self.names)

    def test_logreg_returns_valid_metrics(self):
        metrics, fi, preds = self.fn(self.X, self.y, "logreg", self.names)
        assert 0.0 <= metrics["f1"] <= 1.0

    def test_svm_returns_predictions(self):
        metrics, fi, preds = self.fn(self.X, self.y, "svm", self.names)
        assert len(preds) >= 1

    def test_knn_runs_without_error(self):
        metrics, fi, preds = self.fn(self.X, self.y, "knn", self.names)
        assert isinstance(metrics["accuracy"], float)

    def test_insufficient_data_raises(self):
        with pytest.raises(ValueError):
            self.fn(self.X[:5], self.y[:5], "rf_clf", self.names)

    def test_single_class_raises(self):
        y_single = np.zeros(len(self.y), dtype=int)
        with pytest.raises(ValueError):
            self.fn(self.X, y_single, "rf_clf", self.names)

    def test_fi_sums_to_one(self):
        _, fi, _ = self.fn(self.X, self.y, "rf_clf", self.names)
        assert abs(sum(f.importance for f in fi) - 1.0) < 1e-5


# ── _run_regression ───────────────────────────────────────────────────────────

class TestRunRegression:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess, _run_regression
        rows = _rows_regression(80)
        self.X, self.y, self.names = _preprocess(rows, ["x1", "x2"], "price", "regression")
        self.fn = _run_regression

    def test_linear_r2_positive(self):
        metrics, fi, preds = self.fn(self.X, self.y, "linear", self.names)
        assert metrics["R2"] > 0.5   # data is nearly linear

    def test_ridge_runs(self):
        metrics, fi, preds = self.fn(self.X, self.y, "ridge", self.names)
        assert "RMSE" in metrics and metrics["RMSE"] >= 0

    def test_lasso_runs(self):
        metrics, fi, preds = self.fn(self.X, self.y, "lasso", self.names)
        assert "MAE" in metrics

    def test_xgboost_fallback_runs(self):
        metrics, fi, preds = self.fn(self.X, self.y, "xgboost", self.names)
        assert isinstance(metrics["R2"], float)

    def test_predictions_have_six_periods(self):
        _, _, preds = self.fn(self.X, self.y, "linear", self.names)
        assert len(preds) == 6

    def test_insufficient_data_raises(self):
        with pytest.raises(ValueError):
            self.fn(self.X[:5], self.y[:5], "linear", self.names)


# ── _run_clustering ───────────────────────────────────────────────────────────

class TestRunClustering:
    def setup_method(self):
        from app.api.ml_analysis import _preprocess, _run_clustering
        rows = _rows_clustering(90)
        self.X, _, self.names = _preprocess(rows, ["f1", "f2"], None, "clustering")
        self.fn = _run_clustering

    def test_kmeans_finds_clusters(self):
        metrics, fi, preds = self.fn(self.X, "kmeans", self.names)
        assert metrics["n_clusters"] >= 2
        assert 0.0 <= metrics["silhouette_score"] <= 1.0

    def test_dbscan_runs(self):
        metrics, fi, preds = self.fn(self.X, "dbscan", self.names)
        assert "n_clusters" in metrics

    def test_kmeans_predictions_sum_to_100(self):
        _, _, preds = self.fn(self.X, "kmeans", self.names)
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
        assert len(preds) == 30

    def test_metrics_include_trend(self):
        metrics, fi, preds = self.fn(self.rows, ["event_date"], "revenue", "arima")
        assert "trend_direction" in metrics

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
        metrics, fi, preds = self.fn(self.rows, [], "revenue", "prophet")
        assert len(preds) == 30
