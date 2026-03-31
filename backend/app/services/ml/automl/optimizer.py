"""
Hyperparameter Optimizer — Optuna-based search with sklearn cross-validation.

Falls back to a simple grid when Optuna is not installed.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
from sklearn.model_selection import cross_val_score

logger = logging.getLogger(__name__)

_OPTUNA_AVAILABLE = False
try:
    import optuna
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    _OPTUNA_AVAILABLE = True
except ImportError:
    logger.info("optuna not installed — using default hyperparams")


def _make_model(algo_id: str, params: Dict[str, Any]):
    """Instantiate an sklearn-compatible model from algo_id + params."""
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, GradientBoostingRegressor
    from sklearn.linear_model import LogisticRegression, Ridge, Lasso, LinearRegression
    from sklearn.svm import SVC
    from sklearn.neighbors import KNeighborsClassifier

    mapping = {
        "rf_clf":   lambda p: RandomForestClassifier(**p, random_state=42, n_jobs=-1),
        "logreg":   lambda p: LogisticRegression(**p, solver="lbfgs", random_state=42),
        "svm":      lambda p: SVC(**p, random_state=42),
        "knn":      lambda p: KNeighborsClassifier(**p),
        "xgboost":  lambda p: GradientBoostingClassifier(**_filter(p, ["use_label_encoder", "eval_metric"]), random_state=42),
        "ridge":    lambda p: Ridge(**p),
        "lasso":    lambda p: Lasso(**p, random_state=42),
        "linear":   lambda p: LinearRegression(),
        # regression xgboost uses same key but different estimator — caller resolves
    }
    factory = mapping.get(algo_id)
    if factory is None:
        raise ValueError(f"Unknown algo_id: {algo_id}")
    return factory(params)


def _filter(params: Dict, exclude: List[str]) -> Dict:
    return {k: v for k, v in params.items() if k not in exclude}


class HyperparamOptimizer:
    """
    Tunes hyperparameters for a given algo_id using Optuna TPE sampler.
    Falls back to default params when Optuna is unavailable or n_trials=0.
    """

    def optimize(
        self,
        algo_id: str,
        family: str,
        X: np.ndarray,
        y: np.ndarray,
        n_trials: int = 20,
        cv: int = 3,
        scoring: str | None = None,
    ) -> Tuple[Dict[str, Any], float]:
        """
        Returns (best_params, best_score).
        """
        if not _OPTUNA_AVAILABLE or n_trials == 0 or len(X) < 30:
            logger.debug("optimizer: returning default params for %s", algo_id)
            return self._defaults(algo_id), 0.0

        score_fn = scoring or ("f1_weighted" if family == "classification" else "r2")

        def objective(trial: "optuna.Trial") -> float:
            params = self._suggest(trial, algo_id)
            try:
                model = _make_model(algo_id, params)
                scores = cross_val_score(model, X, y, cv=cv, scoring=score_fn, n_jobs=-1)
                return float(scores.mean())
            except Exception as exc:
                logger.debug("trial failed: %s", exc)
                return -999.0

        study = optuna.create_study(direction="maximize")
        study.optimize(objective, n_trials=n_trials, show_progress_bar=False, n_jobs=1)

        best_params = study.best_params
        best_score  = study.best_value
        logger.debug("optimizer done: algo=%s best_score=%.4f", algo_id, best_score)
        return best_params, best_score

    # ── Search space definitions ──────────────────────────────────────────────

    def _suggest(self, trial: Any, algo_id: str) -> Dict[str, Any]:
        if algo_id == "rf_clf":
            return {
                "n_estimators":      trial.suggest_int("n_estimators", 50, 300),
                "max_depth":         trial.suggest_int("max_depth", 3, 20),
                "min_samples_split": trial.suggest_int("min_samples_split", 2, 20),
                "max_features":      trial.suggest_categorical("max_features", ["sqrt", "log2"]),
            }
        elif algo_id == "xgboost":
            return {
                "n_estimators":  trial.suggest_int("n_estimators", 50, 400),
                "max_depth":     trial.suggest_int("max_depth", 3, 10),
                "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.3, log=True),
                "subsample":     trial.suggest_float("subsample", 0.6, 1.0),
                "min_samples_split": trial.suggest_int("min_samples_split", 2, 10),
            }
        elif algo_id == "logreg":
            return {
                "C":        trial.suggest_float("C", 0.001, 100.0, log=True),
                "max_iter": trial.suggest_int("max_iter", 200, 1000),
            }
        elif algo_id == "svm":
            return {
                "C":     trial.suggest_float("C", 0.1, 100.0, log=True),
                "gamma": trial.suggest_categorical("gamma", ["scale", "auto"]),
            }
        elif algo_id == "knn":
            return {
                "n_neighbors": trial.suggest_int("n_neighbors", 3, 20),
                "weights":     trial.suggest_categorical("weights", ["uniform", "distance"]),
            }
        elif algo_id == "ridge":
            return {"alpha": trial.suggest_float("alpha", 0.001, 100.0, log=True)}
        elif algo_id == "lasso":
            return {"alpha": trial.suggest_float("alpha", 0.001, 10.0, log=True)}
        return {}

    def _defaults(self, algo_id: str) -> Dict[str, Any]:
        defaults = {
            "rf_clf":  {"n_estimators": 150, "max_depth": None},
            "xgboost": {"n_estimators": 200, "max_depth": 6, "learning_rate": 0.05, "subsample": 0.8},
            "logreg":  {"C": 1.0, "max_iter": 500},
            "svm":     {"C": 1.0, "gamma": "scale"},
            "knn":     {"n_neighbors": 5},
            "ridge":   {"alpha": 1.0},
            "lasso":   {"alpha": 0.1},
            "linear":  {},
            "kmeans":  {"n_clusters": 5, "n_init": 10},
            "dbscan":  {"eps": 0.5, "min_samples": 5},
        }
        return defaults.get(algo_id, {})


# Singleton
hyperparameter_optimizer = HyperparamOptimizer()
