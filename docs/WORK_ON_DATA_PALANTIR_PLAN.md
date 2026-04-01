# Work on Data — Palantir AIP-Grade Expansion Plan

> **Prerequisite:** Complete `WORK_ON_DATA_PRODUCTION_GRADE_PLAN.md` first.
> This plan adds major new capabilities on top of a hardened, production-stable base.

---

## Current Verified State (2026-04-01)

All 43 tests pass. Every algorithm working and verified.

### Algorithms — All Working
| Family | Algorithms |
|---|---|
| Classification | Random Forest, SVM, KNN, Logistic Regression |
| Regression | Linear, Ridge, Lasso, GradientBoosting (xgboost key) |
| Clustering | K-Means (auto-k via silhouette), DBSCAN (auto-eps) |
| Time Series | Linear trend + seasonal harmonic (numpy, no deps) |

### New Algorithms Planned
| Family | Algorithm | Phase |
|---|---|---|
| Classification | Gradient Boosting Ensemble (RF+XGB voting) | Phase 7 |
| Regression | ElasticNet (L1+L2 hybrid) | Phase 1 |
| Clustering | HDBSCAN (hierarchical, varying density) | Phase 7 |
| Clustering | Gaussian Mixture Model (soft assignments) | Phase 7 |
| Time Series | SARIMA (seasonal ARIMA) | Phase 7 |

---

## 10-Phase Implementation Plan

---

### Phase 1 — Data Validation Layer (Weeks 1–2)

**New backend files:**
- `backend/app/services/ml/data_validator.py`
  - `DataValidator.validate(df, request)` → `ValidationReport`
  - Checks: null ratios, cardinality, type consistency, class balance (Gini impurity), target leakage in features, min row count per family
- `backend/app/services/ml/feature_engineer.py`
  - `FeatureEngineer.auto_features(df, target_col, family)` → `pd.DataFrame`
  - log1p for skewed numerics, polynomial degree-2 for regression, target encoding (train-fold only), datetime decomposition, mutual-info ranked interactions

**Modify `ml_analysis.py`:**
- Inject `DataValidator.validate()` before preprocessing — 422 on hard errors, warnings in `AnalysisResult.insights`
- Add `validation_report: Optional[ValidationReport]` to `AnalysisResult`
- Add `use_auto_features: bool = False` to `AnalysisRequest`

**New frontend:**
- `frontend/src/components/WorkOnData/DataQualityPanel.jsx`
  - Per-column quality badges: null %, cardinality, type, distribution mini-histogram
  - Color coded green/amber/red — blocks "Run Analysis" on hard errors

---

### Phase 2 — Cross-Validation & Honest Metrics (Weeks 2–3)

**Modify `_run_classification`, `_run_regression`:**
- Add `cv_folds: int = 5` parameter
- Use `StratifiedKFold` (classification) / `KFold` (regression)
- Return per-fold metrics → compute `mean ± std` with 95% CI
- Final model trained on full train set after CV, evaluated on held-out 20%

**New Pydantic model:**
```python
class MetricValue(BaseModel):
    mean: float
    std: float
    ci_lower: float   # mean - 1.96*std
    ci_upper: float   # mean + 1.96*std
```

**New frontend components:**
- `MetricCard.jsx` — mean ± std large, CI bar, color threshold (green/amber/red), hover tooltip with fold distribution
- `LearningCurve.jsx` — train score vs CV score vs training set size (detects overfit)

---

### Phase 3 — Hyperparameter Tuning UI + Live Stream (Weeks 3–4)

**Modify `optimizer.py`:**
- Add `optuna.pruners.MedianPruner()` — prune bad trials early
- Add warm-start: seed first trial from selector defaults
- Add early stopping: stop if no improvement in last 10 trials
- Add async generator `optimize_stream()` — yields `TrialResult` after each trial

**New endpoint:** `POST /api/ml/automl/stream` → SSE
```
event: trial_result
data: {"trial": 5, "algo": "xgboost", "score": 0.847, "best": 0.863}

event: tuning_done
data: {"best_algo": "xgboost", "best_params": {...}, "best_score": 0.863}
```

**New frontend:**
- `TuningPanel.jsx` — per-param sliders/dropdowns, live trial scatter chart, best params display
- `useTuningStream.js` — `fetch + ReadableStream` for SSE over POST

---

### Phase 4 — SHAP Explainability Suite (Weeks 4–5)

**Modify `explainer.py`:**
- `partial_dependence(X, feature_idx, grid_resolution=50)` → PDP data
- `interaction_importances(X, top_n=5)` → SHAP interaction index for tree models
- `counterfactual(x_single, target_class, X_train)` → minimal feature changes to flip prediction (DiCE-lite)

**New endpoints:**
- `POST /api/ml/explain/pdp` — `{connection_id, run_id, feature}` → PDP data
- `POST /api/ml/explain/waterfall` — `{connection_id, run_id, row_index}` → waterfall
- `POST /api/ml/explain/cf` — `{connection_id, run_id, row_index, target_class}` → counterfactual

**New frontend:**
- `ExplainabilityPanel.jsx` — tabs: Global | Row-Level | Interactions | Counterfactual
- `ShapWaterfall.jsx` — base → per-feature contribution → final prediction, row selector
- `PDPChart.jsx` — feature value vs predicted output, ICE lines overlaid, rug density
- `CounterfactualPanel.jsx` — "what would flip this?" diff table: feature / before / after / Δ

---

### Phase 5 — Model Registry & Artifact Store (Weeks 5–6)

**New file:** `backend/app/services/ml/model_registry.py`

```python
@dataclass
class ModelArtifact:
    artifact_id: str
    run_id: str
    algo: str
    family: str
    metrics: Dict[str, Any]
    hyperparams: Dict[str, Any]
    feature_names: List[str]
    file_path: str        # data/models/{artifact_id}/model.pkl
    status: str           # active | archived | champion | challenger
    created_at: float

class ModelRegistry:
    def save(self, run, model, feature_names) -> ModelArtifact   # joblib + SHA-256
    def load(self, artifact_id) -> Tuple[Any, ModelArtifact]     # deserialize + hash check
    def promote(self, artifact_id, role)                          # set champion
    def compare(self, a_id, b_id, metric) -> ComparisonReport    # metric deltas + fi diff
    def list_artifacts(self, experiment, ...) -> List[ModelArtifact]
```

**New endpoints:**
- `GET  /api/ml/registry` — list all artifacts
- `GET  /api/ml/registry/{id}` — artifact detail
- `POST /api/ml/registry/{id}/promote` — set champion
- `POST /api/ml/registry/{id}/predict` — score new rows against saved model
- `GET  /api/ml/registry/{id}/download` — download model.pkl
- `POST /api/ml/registry/compare` — compare two artifacts

**New frontend:** `ModelRegistryPanel.jsx` — leaderboard table, compare, promote, predict, download

---

### Phase 6 — Drift Detection & Monitoring (Weeks 6–7)

**New file:** `backend/app/services/ml/drift_monitor.py`

```python
class DriftMonitor:
    def detect_data_drift(self, reference_df, current_df, feature_names) -> DriftReport
    # KS test (numeric, p<0.05 = drift), Chi-squared (categorical), PSI per feature

    def detect_prediction_drift(self, reference_preds, current_preds) -> PredictionDriftReport
    # KS test on prediction distribution + PSI per class

    def schedule_check(self, artifact_id, connection_id, table, cron) -> None
    # Register drift check with scheduler, auto-dispatch Decision alert on severity=high
```

**New endpoints:**
- `POST /api/ml/drift/check` — `{artifact_id, connection_id, table}` → DriftReport
- `GET  /api/ml/drift/history` — list past drift checks for artifact

**New frontend:** `DriftDashboard.jsx`
- Per-feature severity bars (green=stable, amber=warning, red=drift)
- PSI gauge for overall model health
- Reference vs current distribution overlay (area chart)

---

### Phase 7 — WorkOnDataV2 Full UI Redesign (Weeks 7–9)

**Replaces:** `WorkOnDataModal.jsx` → `WorkOnDataV2.jsx`

**3-panel layout:**
```
┌──────────────┬───────────────────────────────┬──────────────────┐
│  CONFIGURE   │       RESULTS CANVAS          │  INTELLIGENCE    │
│              │                               │                  │
│ ① Data       │  Metrics Row (MetricCard ×N)  │  APEX Insights   │
│ ② Algorithm  │  Feature Importance Chart     │  SHAP Waterfall  │
│ ③ Features   │  Predictions Panel            │  What-If Sliders │
│ ④ Tune       │  Scatter Matrix               │                  │
│ ⑤ Explain    │  Tabs: Charts|SHAP|PDP|CF     │                  │
│              │                               │                  │
│  [Run ▶]     │  [Export ↓] [Pin ⊕]          │                  │
└──────────────┴───────────────────────────────┴──────────────────┘
```

**22 new component files:**
| Component | Purpose |
|---|---|
| `WorkOnDataV2.jsx` | Root 3-panel layout |
| `ConfigPanel.jsx` | Steps ①–⑤ accordion |
| `DataQualityPanel.jsx` | Column profiler |
| `FeatureSelectorPanel.jsx` | Drag-and-drop with importance hints |
| `AlgorithmChooser.jsx` | Family → algo cards with capability badges |
| `TuningPanel.jsx` | Live Optuna trial stream |
| `ResultsCanvas.jsx` | Center tabs: Charts / SHAP / PDP / CF |
| `MetricCard.jsx` | mean ± std with CI bar |
| `LearningCurve.jsx` | Train vs CV score chart |
| `FeatureImportanceChart.jsx` | Horizontal bar with SHAP direction arrows |
| `PredictionPanel.jsx` | Class dist / forecast / cluster map |
| `ScatterMatrix.jsx` | Pairplot top-4 features |
| `CorrelationHeatmap.jsx` | Pearson/Spearman toggle |
| `ShapWaterfall.jsx` | Per-row SHAP waterfall |
| `PDPChart.jsx` | PDP + ICE + rug plot |
| `CounterfactualPanel.jsx` | What-would-flip-this diff table |
| `IntelligencePanel.jsx` | Right panel: insights + waterfall + what-if |
| `WhatIfSliders.jsx` | Feature sliders → live re-score < 200ms |
| `ModelRegistryPanel.jsx` | History, compare, promote, download |
| `DriftDashboard.jsx` | Per-feature drift bars + PSI gauge |
| `ExportPanel.jsx` | PDF / PNG / JSON / Notebook |
| `CostBadge.jsx` | Est. cost display in header |

**UX principles:**
- Guided numbered steps — each validates before next unlocks
- Inline results — no page navigation
- Live streaming — SSE drives progress bar
- What-if interactivity — sliders re-score via `/predict` < 200ms
- Keyboard shortcuts: `⌘R` run, `⌘E` export, `⌘P` pin, `⌘Z` undo

---

### Phase 8 — Investigation Workspace V2 (Weeks 9–10)

**New endpoints:**
- `POST /api/workspace/{id}/snapshot` — save versioned snapshot
- `GET  /api/workspace/{id}/snapshots` — list all snapshots
- `GET  /api/workspace/{id}/snapshots/{snap_id}` — restore snapshot
- `POST /api/workspace/{id}/export` — `{format: "pdf"|"md"|"json"}` → file

**New file:** `backend/app/services/workspace_exporter.py`
- `to_markdown(workspace)` — evidence chain as sections, metrics as tables
- `to_pdf(workspace)` — ReportLab: title, evidence, charts as embedded SVG
- `to_notebook(workspace)` — Jupyter `.ipynb` with code + markdown cells

**Modify `InvestigationWorkspace/index.jsx`:**
- Version history sidebar with diff view and restore
- Export toolbar (PDF / Markdown / Notebook)
- Share button → read-only URL with token
- Chart annotations — click chart → sticky note
- Threshold alerts — right-click metric → "Alert me if F1 drops below X"

---

### Phase 9 — APEX Agent V2 (Weeks 10–11)

**Modify `planner.py`:**
- Pre-fetch schema before planning — inject table names, column types, row counts into system prompt
- Multi-turn: `previous_steps` context in subsequent queries
- Cost tracking: count LLM tokens, store in `MLRun.metadata.cost_usd`
- Confidence threshold: if plan confidence < 0.6, ask clarifying question first

**Modify `executor.py`:**
- Per-step timeout: `asyncio.wait_for(tool_call, timeout=30.0)`
- Step retry: exponential backoff × 2, max 3 retries
- Result caching: `step_cache[hash(tool+params)]` within session
- Partial failure: continue plan if `step.required = False`

**Modify `memory.py`:**
- Long-term memory: persist key findings across sessions
- Semantic search: top-3 related past findings via cosine similarity on embeddings

**Modify `AgentChat.jsx`:**
- Multi-turn input stays active after response
- Memory panel showing recalled past findings
- Cost indicator badge: "~$0.004" per query
- Confidence indicator: amber if agent flagged low confidence
- Step expansion: click step → see full input/output JSON

---

### Phase 10 — Rate Limiting & Observability (Weeks 11–12)

**New files:**
- `backend/app/middleware/rate_limiter.py`
  - Sliding window: 10 `/analyze`/min/tenant, 3 `/automl`/min/tenant
  - Returns 429 + `Retry-After` header
- `backend/app/middleware/request_validator.py`
  - Validates connection_id format, table name allowlist, feature list ≤ 30 before DB access
- `backend/app/services/ml/cost_tracker.py`
  - Per-tenant monthly budget enforcement
  - Tracks: ML run CPU-seconds estimate + LLM token count
  - Raises `BudgetExceededError` if threshold exceeded
  - Endpoint: `GET /api/ml/cost/summary`

**Modify `AuditLogger`:**
- Add `cost_usd` and `latency_ms` to all ML events
- Structured JSON output compatible with ELK / Datadog

---

## Delivery Schedule

| Phase | Scope | Weeks |
|---|---|---|
| 1 | Data Validation + Quality Panel | 1–2 |
| 2 | Cross-Validation + Honest Metrics | 2–3 |
| 3 | Hyperparameter Tuning UI + Live Stream | 3–4 |
| 4 | SHAP Suite: PDP, Waterfall, Counterfactual | 4–5 |
| 5 | Model Registry + Artifact Store | 5–6 |
| 6 | Drift Monitor + Alerts | 6–7 |
| 7 | WorkOnDataV2 Full UI Redesign | 7–9 |
| 8 | Investigation Workspace V2 + Export | 9–10 |
| 9 | APEX Agent V2: multi-turn, memory, cost | 10–11 |
| 10 | Rate limiting, observability, cost tracking | 11–12 |

---

## Key Architectural Constraints

- All new routers use `register_optional()` — server starts even if imports fail
- SSE via POST uses `fetch + ReadableStream` (not EventSource — GET only)
- In-memory ring buffers: Decision 500, Audit 1000 — no DB required for Phase 1–4
- C2 data leakage (AutoML Optuna tunes on full X) — NOT yet fixed, requires nested CV refactor
- `experiment_tracker` singleton created at import — directories created as side effect (known LOW issue)

---

> **Start with:** `WORK_ON_DATA_PRODUCTION_GRADE_PLAN.md` → then return here Phase by Phase.
> Say "start Phase N" to begin that phase.
