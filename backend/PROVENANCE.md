# Data Provenance Guide

This document classifies every metric the backend produces into one of three categories.

## ✅ Real Data (queried directly from the database)

| Metric | Source |
|---|---|
| `row_count` / `current_size` | `SELECT COUNT(*) FROM table` |
| Column names, types, nullability | `information_schema.columns` |
| Foreign key relationships | `information_schema.table_constraints` |
| `n_tup_ins` (Postgres insert count) | `pg_stat_user_tables` |
| `xact_commit` / `xact_rollback` | `pg_stat_database` |
| Actual table data samples | `SELECT * FROM table LIMIT n` |
| Index count | `pg_indexes` |
| Historical transaction records | Direct table queries (when schema permits) |

---

## ⚙️ Computed / Derived (formulas applied to real data)

These values are **mathematically sound** but are not measurements — they are calculations.

| Metric | Formula | Real inputs |
|---|---|---|
| `node_glow` / `glow_intensity` | `α·log(row_count+1) + β·centrality` | row_count (real), centrality (derived) |
| `importance_score` / `gravity` | Centrality × edge weight composite | edge counts (real), weights (derived) |
| `vitality` | Composite of in-degree + out-degree + activity signals | degree counts (real) |
| `entropy` | Distribution of edge weights across the graph | edge weights (derived) |
| `latent_x/y/z` | `x=(revenue_proxy-5000)*x_gain`, `y=(risk*50)+(importance*500)`, `z=(variance-2.5)*z_gain` | all inputs are derived |
| Cluster assignments | Louvain / heuristic graph partitioning | graph topology (real) |

All of these carry `_meta.source = "formula_derived"` or `"graph_topology_estimate"` in API responses.

---

## 〰️ Estimated / Heuristic (fallback paths when real data is unavailable)

These are **estimates** clearly marked as such in API responses with `is_estimated: true` and `_meta.source = "heuristic_estimate"`.

| Metric | Method | When used |
|---|---|---|
| Growth forecast (30d) | 2%/month baseline OR `n_tup_ins` ratio | When <7 days of historical transaction data exist |
| `data_quality.completeness` | `vitality + 5` (constant offset) | Always — real null scan not yet implemented |
| `data_quality.accuracy` | `vitality + 2` | Always — stub |
| `data_quality.consistency` | `vitality + 4` | Always — stub |
| `data_quality.timeliness` | `vitality + 7` | Always — stub |
| `detect_duplicates` result | Hardcoded `{has_duplicates: false}` | Always — stub |
| `detect_format_inconsistencies` | Empty list `[]` | Always — stub |

---

## What is NOT yet implemented

- **Real null/duplicate scan**: `DataQualityEngine.detect_duplicates()` and `detect_format_inconsistencies()` are stubs. Implementing them requires a `SELECT column, COUNT(*) WHERE column IS NULL` scan per table.
- **Trend-based forecasting**: The predictive engine uses linear extrapolation from current row count when historical data is insufficient. A real forecast model (ARIMA, Prophet, or even simple linear regression on timestamped inserts) would require 30+ days of insert timestamps per table.
- **Real-time performance metrics**: `vitality`, `glow_intensity`, and `importance_score` reflect graph structure, not query latency, cache hit rate, or I/O. Those would require pg_stat_activity integration or APM tooling.
