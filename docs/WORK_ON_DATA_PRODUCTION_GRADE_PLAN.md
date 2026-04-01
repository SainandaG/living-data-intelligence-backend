# Work on Data — Production Grade Plan (Existing Feature)

> **Focus:** Make what exists TODAY fully production-grade before expanding.
> No new algorithms, no new ML features, no new UI panels.
> Only hardening, correctness, tests, UX reliability, and API cleanliness.

---

## Current Verified State (2026-04-01)

- 43/43 backend unit tests passing
- 10 algorithms across 4 families all working
- Security fixes applied (SQL injection, error message sanitization, Literal validation)
- Experiment tracker: async, thread-safe, log rotation
- SHAP model wired in AutoML

### Bugs Already Fixed This Session
| ID | Fix |
|---|---|
| C1 | `_safe_quote` allowlist regex — SQL injection blocked |
| C3 | Tuned hyperparams from Optuna now passed to final model fit |
| H1+H3 | `experiment_tracker` async + `threading.Lock` — non-blocking, race-condition safe |
| H2 | Log rotation at 10 MB (`EXPERIMENTS_MAX_MB` env var) |
| H4 | `_run_*` returns trained model — AutoML passes real model to SHAP Explainer |
| H5 | `n_trials ≤ 100`, `max_candidates ≤ 10` via Pydantic Field |
| H6 | Time series fits on train split only — true holdout evaluation |
| M1 | `np.unique(..., return_counts=True)` replaces `bincount` |
| M5 | `Literal[...]` on `family` field |
| M6 | All 500 handlers return generic message only |
| DBSCAN | `UnboundLocalError` — `best_model` now set in DBSCAN branch |
| sklearn 1.8 | `LogisticRegression multi_class="auto"` removed |

---

## 5-Track Production Plan

---

### Track 1 — Backend Cleanliness (1–2 days)

**T1-1: Remove duplicate imports in `ml_analysis.py` (lines 18/23 vs 30/31)**
- Merge into single import block at top
- Remove redundant `from typing import ...` and `from pydantic import BaseModel`

**T1-2: Remove or implement `secondary_tables`**
- Currently: accepted in `AnalysisRequest`, sent by frontend, silently ignored in handler
- Fix: remove from `AnalysisRequest` (dead param misleads API consumers)
- Remove from `WorkOnDataModal.jsx` call site too

**T1-3: Enforce ML run timeout**
- `_run_classification`, `_run_regression`, `_run_clustering`, `_run_timeseries` run unboundedly
- Fix: wrap `loop.run_in_executor()` calls in `asyncio.wait_for(..., timeout=120.0)`
- On timeout: `finish_run(status="timeout")`, return HTTP 504 with clear message

**T1-4: Distinguish DB errors from empty tables**
- Current: silently returns `[]` on DB error
- Fix: "table empty" → 422, "connection failed" → 503

**T1-5: Validate `algo` matches `family`**
- Currently: unknown algo silently falls to default (logreg / GradientBoosting)
- Fix: Pydantic model_validator:
```python
VALID_ALGOS = {
    "classification": {"rf_clf", "svm", "knn", "logreg"},
    "regression":     {"linear", "ridge", "lasso", "xgboost"},
    "clustering":     {"kmeans", "dbscan"},
    "timeseries":     {"arima", "prophet"},
}
```

---

### Track 2 — Test Coverage (2–3 days)

**T2-1:** Fix existing tests for new algo/family validator (T1-5)

**T2-2: Edge case tests per algorithm**
- Classification: imbalanced classes (99%/1%), max 5000-row cap enforced
- Regression: all-zero target, single feature, negative R²
- Clustering: DBSCAN all-noise result, k-means max_k=2 forced
- Time Series: fewer than 14 points (no seasonality path), flat target

**T2-3: `_build_insights` parametric tests**
- All 4 families × excellent / poor / borderline metrics
- Verify precision>recall and recall>precision branches fire

**T2-4: `AutoMLRequest` validation tests**
- `n_trials` > 100 rejected, `max_candidates` > 10 rejected
- Invalid `family` rejected, invalid `algo` for `family` rejected

**T2-5: Experiment tracker async tests**
- 10 concurrent `start_run` / `finish_run` calls → file not corrupted
- `get_runs` after rotation → `.bak` exists, new file has only new records
- `get_best_run` with no completed runs → returns `None`

---

### Track 3 — Frontend Reliability (2–3 days)

**T3-1: Replace fake progress with real polling**
- Current: `useMLJob.js` hardcodes `10% → 30% → 100%` on setTimeout
- Fix: poll `GET /api/ml/run/{run_id}/status` every 2s until `status != "running"`
- Remove all fake `setTimeout` delays

**T3-2: Job cancellation**
- Add `AbortController` to `useMLJob.js`
- Show "Cancel" button in `WorkOnDataModal` during running state
- On abort: call `DELETE /api/ml/run/{run_id}` → marks run as cancelled

**T3-3: Structured error messages by HTTP status**
| HTTP Code | Message shown to user |
|---|---|
| 422 | "Check your column selection: {detail}" |
| 504 | "Analysis timed out — try fewer features or a faster algorithm" |
| 503 | "Database connection failed — check your connection" |
| 500 | "Unexpected error — our team has been notified" |

**T3-4: Correct results display for all 4 families**
- Classification: accuracy + F1 + class distribution
- Regression: R² + RMSE + 6-period predictions
- Clustering: silhouette + n_clusters + cluster sizes
- Time Series: trend direction + MAPE + 6 forecast points
- Add family-specific metric labels (not generic "Metric 1, Metric 2")

**T3-5: Remove `secondary_tables` from frontend**
- Remove `selectedSecondaryTables` state and multi-select UI (matches T1-2)

---

### Track 4 — API Completeness (1–2 days)

**T4-1: Add `GET /api/ml/run/{run_id}/status`**
- Returns: `{run_id, status, algo, family, table, duration_s, metrics_preview}`
- Used by frontend polling (T3-1)

**T4-2: Add `DELETE /api/ml/run/{run_id}`**
- Marks run as cancelled in experiment tracker
- Used by frontend cancellation (T3-2)

**T4-3: Add FastAPI response descriptions**
- Document 422, 504, 500 responses on `/analyze`, `/automl`, `/suggest`
- Document `tenant_id` param behavior on `/experiments`

**T4-4: Fix `/suggest` — POST → GET**
- Current: `@router.post("/suggest")` with no request body (only query params)
- Fix: `@router.get("/suggest")` with `connection_id: str` and `table: str` as query params

---

### Track 5 — Operational Hardening (1–2 days)

**T5-1: Startup validation**
- Verify `data/experiments/` is writable on app startup
- Log warning (not crash) if `EXPERIMENTS_DIR` env var is non-writable

**T5-2: Request size limits on `/analyze`**
- `features` list: max 20 items (validated at Pydantic level, not just in SQL builder)
- `table` name: max 128 chars

**T5-3: Read lock in experiment tracker**
- Current: `_write_locked` holds lock but `get_runs` reads without it
- Fix: acquire `self._lock` inside `get_runs` — prevents partial-line read during rotation

**T5-4: Add `/api/ml/health` endpoint**
- Returns: `{status: "ok", experiments_dir_writable: bool, runs_count: int, last_run_at: float|null}`
- Used by monitoring and uptime checks

---

## Delivery Order

| Order | Track | Why |
|---|---|---|
| 1st | Track 1 — Backend Cleanliness | Fix silent bugs before writing tests against them |
| 2nd | Track 2 — Test Coverage | Lock in correct behaviour immediately after cleanup |
| 3rd | Track 4 — API Completeness | New endpoints needed by frontend fixes |
| 4th | Track 3 — Frontend Reliability | Depends on Track 4 endpoints |
| 5th | Track 5 — Operational Hardening | Final pass once feature is functionally correct |

---

## Files Touched (no new feature files created)

| File | Tracks |
|---|---|
| `backend/app/api/ml_analysis.py` | 1, 4 |
| `backend/app/services/ml/experiment_tracker.py` | 5 |
| `backend/tests/test_ml_analysis.py` | 2 |
| `frontend/src/hooks/useMLJob.js` | 3 |
| `frontend/src/components/Dashboard/WorkOnDataModal.jsx` | 3 |

---

## Definition of Done

- [ ] All 43 existing tests pass + all new Track 2 tests pass
- [ ] Zero hardcoded fake progress in frontend
- [ ] All 4 families display correct family-specific metrics in UI
- [ ] Unknown algo/family combinations rejected at API boundary with clear message
- [ ] ML runs have 120s timeout — no request hangs forever
- [ ] `/api/ml/health` returns 200 with correct stats
- [ ] `secondary_tables` removed from both backend and frontend
- [ ] No duplicate imports in `ml_analysis.py`
- [ ] `/suggest` changed from POST to GET

---

> **After this plan is complete → proceed to** `WORK_ON_DATA_PALANTIR_PLAN.md`
