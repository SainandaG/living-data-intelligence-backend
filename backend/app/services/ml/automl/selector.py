"""
Algorithm Selector — scores candidate algorithms against a data profile
and returns a ranked shortlist with reasoning.

No heavy deps — uses heuristic rules derived from years of AutoML research.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class AlgoCandidate:
    algo_id:     str
    family:      str
    score:       float          # 0-1, higher = more recommended
    reason:      str
    hyperparams: Dict[str, Any]


class AlgorithmSelector:
    """
    Given a data profile (n_rows, n_features, class_balance, etc.)
    returns an ordered list of AlgoCandidates to try.
    """

    # Default search spaces used by optimizer
    SEARCH_SPACES: Dict[str, Dict] = {
        "rf_clf": {
            "n_estimators": ("int", 50, 300),
            "max_depth":    ("int_or_none", 3, 20),
            "min_samples_split": ("int", 2, 20),
        },
        "xgboost": {
            "n_estimators": ("int", 50, 400),
            "max_depth":    ("int", 3, 10),
            "learning_rate": ("float_log", 0.005, 0.3),
            "subsample":    ("float", 0.6, 1.0),
        },
        "logreg": {
            "C": ("float_log", 0.001, 100.0),
            "max_iter": ("int", 200, 1000),
        },
        "ridge": {
            "alpha": ("float_log", 0.001, 100.0),
        },
        "lasso": {
            "alpha": ("float_log", 0.001, 10.0),
        },
        "linear": {},
        "svm": {
            "C":      ("float_log", 0.1, 100.0),
            "gamma":  ("categorical", ["scale", "auto"]),
        },
        "knn": {
            "n_neighbors": ("int", 3, 20),
            "weights":     ("categorical", ["uniform", "distance"]),
        },
        "kmeans": {
            "n_clusters": ("int", 2, 15),
        },
        "dbscan": {
            "eps":          ("float", 0.1, 2.0),
            "min_samples":  ("int", 3, 20),
        },
    }

    def rank(
        self,
        family: str,
        n_rows: int,
        n_features: int,
        n_classes: Optional[int] = None,
        has_imbalance: bool = False,
        has_nulls: bool = False,
        numeric_ratio: float = 1.0,
        target_dtype: str = "numeric",
    ) -> List[AlgoCandidate]:
        """
        Returns algorithms for the given family, scored and ordered.
        """
        family = family.lower()
        if family == "classification":
            return self._rank_classification(n_rows, n_features, n_classes, has_imbalance, numeric_ratio)
        elif family == "regression":
            return self._rank_regression(n_rows, n_features, numeric_ratio)
        elif family == "clustering":
            return self._rank_clustering(n_rows, n_features)
        elif family == "timeseries":
            return self._rank_timeseries(n_rows)
        return []

    # ── Family rankers ────────────────────────────────────────────────────────

    def _rank_classification(
        self,
        n_rows: int,
        n_features: int,
        n_classes: Optional[int],
        has_imbalance: bool,
        numeric_ratio: float,
    ) -> List[AlgoCandidate]:
        candidates = []

        # GradientBoosting / XGBoost — best default for tabular
        xgb_score = 0.85
        if n_rows < 500:
            xgb_score -= 0.15   # overfits on tiny datasets
        if has_imbalance:
            xgb_score += 0.05   # scale_pos_weight helps
        candidates.append(AlgoCandidate(
            algo_id="xgboost", family="classification",
            score=min(xgb_score, 1.0),
            reason="Best tabular accuracy; handles mixed types and missing values natively",
            hyperparams={"n_estimators": 200, "max_depth": 6, "learning_rate": 0.05,
                         "subsample": 0.8, "use_label_encoder": False, "eval_metric": "logloss"},
        ))

        # Random Forest
        rf_score = 0.78
        if n_features > 50:
            rf_score += 0.05    # handles high-dim well
        candidates.append(AlgoCandidate(
            algo_id="rf_clf", family="classification",
            score=min(rf_score, 1.0),
            reason="Robust, parallelisable; good baseline for high-dimensional data",
            hyperparams={"n_estimators": 150, "max_depth": None, "class_weight": "balanced" if has_imbalance else None},
        ))

        # Logistic Regression
        lr_score = 0.60
        if n_features > n_rows:
            lr_score += 0.15    # high-dim sparse → works well
        candidates.append(AlgoCandidate(
            algo_id="logreg", family="classification",
            score=min(lr_score, 1.0),
            reason="Fast, interpretable baseline; ideal for linear boundaries",
            hyperparams={"C": 1.0, "max_iter": 500, "class_weight": "balanced" if has_imbalance else None},
        ))

        # SVM — only worth it for medium datasets
        svm_score = 0.65 if 500 <= n_rows <= 10_000 else 0.40
        candidates.append(AlgoCandidate(
            algo_id="svm", family="classification",
            score=svm_score,
            reason="Strong for medium datasets with clear margins; slow on large data",
            hyperparams={"C": 1.0, "kernel": "rbf", "probability": True},
        ))

        return sorted(candidates, key=lambda c: c.score, reverse=True)

    def _rank_regression(
        self, n_rows: int, n_features: int, numeric_ratio: float
    ) -> List[AlgoCandidate]:
        candidates = []

        # Gradient Boosting (best general regressor)
        candidates.append(AlgoCandidate(
            algo_id="xgboost", family="regression",
            score=0.88,
            reason="Best general-purpose regressor for tabular data",
            hyperparams={"n_estimators": 200, "max_depth": 5, "learning_rate": 0.05},
        ))

        # Ridge — good when features are correlated
        candidates.append(AlgoCandidate(
            algo_id="ridge", family="regression",
            score=0.72,
            reason="Handles multicollinearity; fast and reliable baseline",
            hyperparams={"alpha": 1.0},
        ))

        # Linear
        candidates.append(AlgoCandidate(
            algo_id="linear", family="regression",
            score=0.60,
            reason="Transparent baseline; use when relationships are linear",
            hyperparams={},
        ))

        # Lasso — when feature selection matters
        lasso_score = 0.65 if n_features > 20 else 0.55
        candidates.append(AlgoCandidate(
            algo_id="lasso", family="regression",
            score=lasso_score,
            reason="Automatic feature selection via L1 regularisation",
            hyperparams={"alpha": 0.1},
        ))

        return sorted(candidates, key=lambda c: c.score, reverse=True)

    def _rank_clustering(self, n_rows: int, n_features: int) -> List[AlgoCandidate]:
        candidates = [
            AlgoCandidate(
                algo_id="kmeans", family="clustering",
                score=0.80,
                reason="Fast, scalable; best when clusters are roughly spherical",
                hyperparams={"n_clusters": "auto", "n_init": 10, "random_state": 42},
            ),
            AlgoCandidate(
                algo_id="dbscan", family="clustering",
                score=0.70,
                reason="Finds arbitrary shapes; excellent for noise/outlier detection",
                hyperparams={"eps": "auto", "min_samples": max(3, n_rows // 100)},
            ),
        ]
        return candidates

    def _rank_timeseries(self, n_rows: int) -> List[AlgoCandidate]:
        candidates = [
            AlgoCandidate(
                algo_id="prophet", family="timeseries",
                score=0.85 if n_rows >= 90 else 0.60,
                reason="Handles seasonality, holidays, missing values; business-friendly",
                hyperparams={"seasonality_mode": "multiplicative", "yearly_seasonality": True},
            ),
            AlgoCandidate(
                algo_id="arima", family="timeseries",
                score=0.75,
                reason="Classic ARIMA; works well for stationary series with clear trends",
                hyperparams={"order": "auto"},
            ),
        ]
        return sorted(candidates, key=lambda c: c.score, reverse=True)


# Singleton
algorithm_selector = AlgorithmSelector()
