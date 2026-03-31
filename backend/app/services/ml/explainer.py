"""
Explainer — SHAP-based feature importance and explanation layer.

Falls back to built-in feature_importances_ / coef_ when SHAP is not
installed, so the rest of the platform never breaks.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

_SHAP_AVAILABLE = False
try:
    import shap
    _SHAP_AVAILABLE = True
except ImportError:
    logger.warning("shap not installed — falling back to native importances")


class Explainer:
    """
    Wraps a trained sklearn estimator and computes per-feature explanations.

    Usage:
        exp = Explainer(model, X_train, feature_names)
        importances = exp.feature_importances(X_test[:100])
        waterfall   = exp.waterfall(X_test[0])   # single-instance
    """

    def __init__(
        self,
        model: Any,
        X_background: np.ndarray,
        feature_names: List[str],
        family: str = "classification",
    ) -> None:
        self.model         = model
        self.feature_names = feature_names
        self.family        = family
        self._explainer    = None

        if _SHAP_AVAILABLE:
            self._explainer = self._build_shap_explainer(model, X_background)

    # ── Public API ────────────────────────────────────────────────────────────

    def feature_importances(
        self, X: np.ndarray, top_n: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Returns [{name, importance, direction}] sorted by |importance| desc.
        Uses SHAP mean(|shap_values|) when available.
        """
        if _SHAP_AVAILABLE and self._explainer is not None:
            return self._shap_importances(X, top_n)
        return self._native_importances(top_n)

    def waterfall(self, x_single: np.ndarray) -> Dict[str, Any]:
        """
        Returns a SHAP waterfall dict for a single observation.
        Falls back to global importances when SHAP not available.
        """
        if not _SHAP_AVAILABLE or self._explainer is None:
            return {"available": False, "reason": "shap_not_installed"}

        try:
            sv = self._explainer(x_single.reshape(1, -1))
            values = sv.values[0] if hasattr(sv, "values") else sv[0]
            if values.ndim == 2:          # multi-class — take mean across classes
                values = values.mean(axis=1)
            base = float(sv.base_values[0]) if hasattr(sv, "base_values") else 0.0
            return {
                "available": True,
                "base_value": base,
                "features": [
                    {"name": n, "shap_value": float(v), "feature_value": float(x_single[i])}
                    for i, (n, v) in enumerate(zip(self.feature_names, values))
                ],
            }
        except Exception as exc:
            logger.warning("waterfall failed: %s", exc)
            return {"available": False, "reason": str(exc)}

    # ── Internals ─────────────────────────────────────────────────────────────

    def _build_shap_explainer(self, model: Any, X_bg: np.ndarray):
        try:
            # Tree-based models — fastest
            model_type = type(model).__name__
            if any(t in model_type for t in ("Forest", "Tree", "Gradient", "XGB", "LGBM")):
                bg = shap.sample(X_bg, min(100, len(X_bg)))
                return shap.TreeExplainer(model)

            # Linear models
            if any(t in model_type for t in ("Linear", "Ridge", "Lasso", "Logistic")):
                return shap.LinearExplainer(model, X_bg)

            # Generic fallback — slower but universal
            bg = shap.sample(X_bg, min(50, len(X_bg)))
            return shap.KernelExplainer(
                model.predict_proba if hasattr(model, "predict_proba") else model.predict,
                bg,
            )
        except Exception as exc:
            logger.warning("shap explainer build failed: %s", exc)
            return None

    def _shap_importances(self, X: np.ndarray, top_n: int) -> List[Dict]:
        try:
            sample = X[: min(200, len(X))]
            sv = self._explainer(sample)
            values = sv.values if hasattr(sv, "values") else sv
            if values.ndim == 3:          # multi-class output
                values = np.abs(values).mean(axis=2)
            mean_abs = np.abs(values).mean(axis=0)
            total = mean_abs.sum() or 1.0
            pairs = sorted(
                zip(self.feature_names, mean_abs),
                key=lambda x: x[1], reverse=True,
            )[:top_n]
            return [
                {
                    "name": name,
                    "importance": round(float(imp / total), 4),
                    "shap_mean_abs": round(float(imp), 6),
                    "direction": "positive" if float(imp) >= 0 else "negative",
                }
                for name, imp in pairs
            ]
        except Exception as exc:
            logger.warning("shap importances failed, falling back: %s", exc)
            return self._native_importances(top_n)

    def _native_importances(self, top_n: int) -> List[Dict]:
        importances: Optional[np.ndarray] = None

        if hasattr(self.model, "feature_importances_"):
            importances = self.model.feature_importances_
        elif hasattr(self.model, "coef_"):
            coef = self.model.coef_
            importances = np.abs(coef[0] if coef.ndim == 2 else coef)
        elif hasattr(self.model, "estimators_"):
            # VotingClassifier / Stacking
            for est in self.model.estimators_:
                if hasattr(est, "feature_importances_"):
                    importances = est.feature_importances_
                    break

        if importances is None:
            return [{"name": n, "importance": 0.0} for n in self.feature_names[:top_n]]

        total = importances.sum() or 1.0
        pairs = sorted(
            zip(self.feature_names, importances),
            key=lambda x: x[1], reverse=True,
        )[:top_n]
        return [
            {"name": name, "importance": round(float(imp / total), 4)}
            for name, imp in pairs
        ]
