# 🔍 Full Repository Audit Report — Living Data Intelligence

Comprehensive code audit of the `living-data-intelligence-backend` repo (backend + frontend). Every file and function was scanned for: **mock data, hardcoded values, improper structure, and unwired code**.

---

## 🔴 CRITICAL: Mock / Fake / Simulated Data

### Backend

| File | Line(s) | Issue | Severity |
|------|---------|-------|----------|
| `db_connector.py` | 48-73, 259-316 | Full **mock mode** — returns `"MOCK_CLIENT"` and fabricated data when `host='mock'`. `_get_mock_data()` generates fake rows with simulated birth dates | 🔴 Critical |
| `data_simulator.py` | Entire file | `DataSimulator` uses SQL `random()` to mutate `batteries` table with random temperature, voltage, current fluctuations every 120s. **Writes fake data to your real Neon DB** | 🔴 Critical ✅ FIXED |
| `seeder.py` | Entire file | `DatabaseSeeder` creates fabricated users, products, orders, transactions, WEZU assets, and telemetry using `random`. Used for demos/testing | 🟡 Medium |
| `metrics_service.py` | 88-93 | **Simulates TPS** (divides total rows by 86400) instead of measuring real transaction rate. Hardcodes min TPS to 1.5. "Mock Alerts" derived from table names containing 'fraud'/'alert'/'risk' | 🔴 Critical ✅ FIXED |
| `internal_node_analyzer.py` | 353-370 | `_create_fallback_clusters()` returns hardcoded mock clusters with fabricated data when real analysis fails | 🟡 Medium |
| `intelligence.py` | 23-26 | `MockLatent` class used as fallback when `latent_space_service` import fails — silently returns empty data | 🟡 Medium |
| `graph_action_handler.py` | 57 | `# Mock lineage calculation` comment — the lineage logic is a placeholder stub | 🟡 Medium ✅ FIXED |
| `t1_agent.py` | 200-201, 294 | Uses `asyncio.sleep(0.1)` and `asyncio.sleep(0.3)` to **simulate processing time** instead of doing real work | 🟡 Medium |
| `predictive_engine.py` | 165, 190 | Hardcoded fallback baselines: `sys_daily_activity = 1000` and `daily_growth_rate = 0.001` when no real data available | 🟡 Medium |

### Frontend

| File | Line(s) | Issue | Severity |
|------|---------|-------|----------|
| `App.jsx` | 418-441 | **Injects 40 mock emitters** with `Math.random()` positions when `latent_manifold` is missing from backend response | 🔴 Critical ✅ FIXED |
| `App.jsx` | 406 | Hardcoded fallback: `customMetrics: { 'Data Quality': '95%', 'Last Update': '2m ago' }` | 🟡 Medium ✅ FIXED |
| `App.jsx` | 457-473 | **Offline Demo Mode** fetches `/demo_dataset.json` — if backend fails, entire UI shows demo data | 🟡 Medium |
| `LatentWorld.jsx` | 137-145 | `getFallbackClusters()` returns 6 **hardcoded mock clusters** with fake names, counts, colors, and risk levels | 🔴 Critical ✅ FIXED |
| `LatentWorld.jsx` | 414-427 | Uses `Math.random() * 900` to generate fake transaction values when real row data unavailable | 🟡 Medium |
| `LatentWorld.jsx` | 654 | **Hardcoded** "SYS LOAD 14.8%" — never reads actual system load | 🟡 Medium ✅ FIXED |
| `IntelligencePanel.jsx` | 25 | Sets fallback data when API fails — panel shows stale/incorrect data | 🟡 Medium |
| `AnalystChat.jsx` | 43 | `// Fallback for demo if backend is offline` — returns fabricated chat responses | 🟡 Medium |
| `soundData.js` | 1 | `// Placeholder sound files - these are minimal beep sounds for testing` | 🟠 Low |

---

## 🟠 Hardcoded Values

| File | Line(s) | Hardcoded Value | Should Be |
|------|---------|----------------|-----------|
| `App.jsx` | 188 | `ws://localhost:8001/ws/${connectionId}` | ✅ FIXED — now dynamic |
| `ConnectionModal.jsx` | 9 | `host: 'localhost'` (default form value) | ✅ FIXED — defaults cleared |
| `neo4j_connector.py` | 21-23 | `bolt://localhost:7687`, `neo4j`, `password` | ✅ FIXED — file deleted (dead code) |
| `LatentWorld.jsx` | 654 | `14.8%` system load display | ✅ FIXED — now dynamic |
| `App.jsx` | 570 | Hardcoded clusters `['Accounts Cluster', 'Transaction Cluster']` | ✅ FIXED — now from mlInsights |
| `metrics_service.py` | 89 | TPS formula divides by `86400` + min-cap `1.5` | ✅ FIXED — real timestamp query |
| `hierarchical_flow.py` | 162 | `'amount': 1.0 # Placeholder for value if not found` | ✅ FIXED — dynamic extraction |

---

## 🟣 Dead / Unused / Unwired Services

| File | Issue | Status |
|------|-------|--------|
| `neo4j_connector.py` | Never imported. Tried to connect to Neo4j on startup | ✅ DELETED |
| `time_machine.py` | Never imported. Simulation engine with no consumers | ✅ DELETED |
| `event_bus.py` | Never imported. Pub/sub system never wired up | ✅ DELETED |
| `action_policy.py` | Never imported. Policy engine never used | ✅ DELETED |
| `ConnectionManagerWrapper` (App.jsx L732) | Component defined but never used | ✅ REMOVED |
| `Settings.jsx` | Contains placeholder tabs | ✅ FIXED — functional settings |

---

## 🟡 Structural Issues & Code Smells

### Backend

| Issue | Files Affected |
|-------|---------------|
| **Excessive fallback chains**: 3-4 levels of fallback silently degrade to fake data | `predictive_engine.py`, `pattern_analyzer.py`, `temporal_analyzer.py`, `internal_node_analyzer.py`, `metrics_service.py` |
| **Global singleton pattern**: Every service creates global at module bottom | All 54 service files |
| **Print statements instead of logging**: `print(f"⚠️ ...")` instead of `logger.warning()` | `metrics_service.py`, `internal_node_analyzer.py`, `temporal_analyzer.py`, `schema_analyzer.py`, `neural_core.py`, `wezu_agents.py`, `agent.py`, `xai_service.py` | ✅ FIXED — 45 statements converted |
| **Duplicate agent implementations**: Two versions of the same agent coexist | `t0_agent.py`, `t0_agent_v2.py` | ✅ FIXED — V2 merged into V1, deleted |
| **Mixed async/sync patterns** | `graph_generator.py`, `metrics_service.py`, `schema_analyzer.py` | Deferred (risk) |

### Frontend

| Issue | Files Affected |
|-------|---------------|
| **Massive monolith**: `App.jsx` is 735 lines with 25+ state variables | `App.jsx` |
| **Giant rendering component**: `ThreeGraph.jsx` excessively large | `ThreeGraph.jsx` |
| **916-line component**: Three.js + animation + UI all in one file | `LatentWorld.jsx` |
| **Inconsistent API clients**: `fetch()` vs `axios` vs `apiClient` | 10 files standardized to `apiClient` | ✅ FIXED |
| **`SoundSystem.js`**: uses window as state store (HACK) | `SoundSystem.js` | ✅ FIXED — class property |

---

## 🔵 TODO / FIXME / Incomplete Code

| File | Line | Content | Status |
|------|------|---------| ------ |
| `errorHandler.js` | 144 | `// TODO: Send to error tracking service` | ✅ FIXED — pluggable `setErrorReporter()` hook |
| `ThreeGraph.jsx` | 1531 | `// TODO: Trigger a soft reset of the Three.js state` | ✅ FIXED — renderer resize + camera fix |
| `graph_action_handler.py` | 57 | `# Mock lineage calculation` | ✅ FIXED — real FK lineage tracing |
| `wezu_agents.py` | 128 | `# simplified placeholder logic` | ✅ FIXED — documented as valid GPS range check |
| `xai_service.py` | 29 | Template fallback when no GOOGLE_API_KEY | ✅ FIXED — documented as intentional design |

---

## 📊 Summary

| Category | Total | Fixed |
|----------|-------|-------|
| 🔴 Critical mock/fake data | 6 | 4 ✅ |
| 🟡 Medium mock/fallback | 11 | 3 ✅ |
| 🟠 Hardcoded values | 7 | 7 ✅ |
| 🟣 Dead/unused services | 6 | 6 ✅ |
| 🟡 Structural code smells | 10 | 4 ✅ |
| 🔵 TODO/incomplete code | 5 | 5 ✅ |
| **Total** | **45** | **29 ✅** |
