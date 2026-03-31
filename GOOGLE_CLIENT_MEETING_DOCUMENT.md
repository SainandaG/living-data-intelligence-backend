# Living Data Intelligence Platform
## Google Partnership & Startup Credits Proposal

**Project:** Living Data Intelligence Platform — `sasir` branch
**Repository:** `living-data-intelligence-backend-sasir` (monorepo: React 19 frontend + FastAPI backend)
**Meeting Format:** 20 min Platform Demo · 40 min Integration Roadmap · 15 min Business & Credits Discussion
**Goal:** Demonstrate current capabilities, present the Google MCP Agents + Vertex AI integration roadmap, and secure Google Cloud Startup Credits to accelerate production deployment

---

## SECTION 1 — WHAT WE BUILT (Platform Overview)

### The One-Line Pitch

> **"We make databases alive — connect any database, and watch your data think in 3D, in real-time, with AI you can talk to."**

---

### The Problem We Solve

Every company with more than 50 database tables faces the same invisible crisis:

| Pain | What Actually Happens | Cost to Enterprise |
|---|---|---|
| Schema blindness | Nobody knows what the DB does anymore — original devs left, docs are stale | 3–6 months onboarding for new engineers |
| No early warning system | Data incidents discovered after they've impacted production | Avg $5,600/min of downtime (Gartner) |
| Natural language barrier | Analysts depend on developers to write SQL for every question | 2–5 day turnaround per data request |
| No intelligence layer | Monitoring tools (DataDog, Grafana) show metrics — not meaning | Reactive operations, not proactive |
| Isolated databases | No cross-system visibility or AI reasoning across schemas | Blind spots in multi-service architectures |

**We address all five simultaneously.** Not with another dashboard — with a living, breathing 3D intelligence layer that understands your database the way a senior DBA would.

---

### Repository Structure (Current State — March 2026)

```
living-data-intelligence-backend-sasir/
│
├── backend/                          FastAPI Python 3.12 backend
│   ├── app/
│   │   ├── api/                      REST endpoints
│   │   │   ├── intelligence.py       AI Intelligence Hub (10 analysis tabs)
│   │   │   ├── ml_analysis.py        Real ML engine (sklearn 1.4 — classification,
│   │   │   │                         regression, clustering, time series)
│   │   │   ├── chat.py               Gemini 2.0 AI chat
│   │   │   └── connections.py        Multi-DB connection management
│   │   ├── services/
│   │   │   ├── db_connector.py       PostgreSQL / MySQL / MongoDB connectors
│   │   │   ├── schema_analyzer.py    Auto-introspection + relationship mapping
│   │   │   ├── realtime/
│   │   │   │   └── monitor.py        WebSocket real-time health monitoring
│   │   │   ├── data_intelligence_analyzer.py   Growth, anomaly, forecast analysis
│   │   │   ├── pattern_analyzer.py   Temporal + structural pattern detection
│   │   │   ├── root_cause_analyzer.py FK dependency traversal + impact mapping
│   │   │   ├── chat_service.py       Gemini 2.0 flash-lite integration
│   │   │   └── gravity_engine.py     Node importance scoring (PageRank + Gravity)
│   │   └── ml/
│   │       ├── gnn_model.py          Graph Attention Network (PyTorch — feature-flagged off)
│   │       ├── latent_manager.py     PCA dimensionality reduction (sklearn)
│   │       └── graph_neural_core.py  Neural core state machine
│   └── requirements.txt
│
├── frontend/                         React 19 + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Intelligence/         10-tab Intelligence Hub (Health, Search,
│   │   │   │                         Ontology, Diagnose, Patterns, Risks,
│   │   │   │                         Forecast, Impact, Actions, Utils)
│   │   │   ├── Dashboard/
│   │   │   │   └── WorkOnDataModal.jsx  ML analysis launcher with real sklearn backend
│   │   │   ├── Layout/               DashboardLayout, navigation
│   │   │   └── ThreeGraph/           Three.js 3D database visualization
│   │   └── utils/
│   │       └── apiClient.js          Axios-based API client
│   └── package.json
│
├── docker-compose.yml
└── GOOGLE_CLIENT_MEETING_DOCUMENT.md  (this file)
```

**Active branch:** `sasir` — all features below are live and tested against real PostgreSQL and MySQL databases.

---

## SECTION 2 — COMPLETE ARCHITECTURE FLOW

### Level 1: System Architecture

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    LIVING DATA INTELLIGENCE PLATFORM                         ║
║                         Full System Architecture                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│  USER'S BROWSER                                                               │
│                                                                               │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────────────────┐  │
│  │  3D Visualization│  │  AI Chat Panel │  │  Intelligence Hub (10 tabs)  │  │
│  │  Three.js +      │  │  Gemini 2.0    │  │  Health · Search · Ontology  │  │
│  │  React Three     │  │  NL→SQL        │  │  Diagnose · Patterns · Risks │  │
│  │  Fiber           │  │  interface     │  │  Forecast · Impact · Actions  │  │
│  └────────┬─────────┘  └───────┬────────┘  └──────────────┬───────────────┘  │
│           │                   │                            │                  │
│           └───────────────────┴────────────────────────────┘                  │
│                               │                                               │
│                    WebSocket (real-time) + REST/HTTP                          │
└───────────────────────────────┼─────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────────┐
│  FASTAPI BACKEND  (Python 3.12, asyncio, uvicorn)                            │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  API LAYER                                                            │   │
│  │  /api/intelligence  /api/ml/analyze  /api/chat  /api/connections      │   │
│  │  /api/schema        /api/anomalies   /api/agents  /api/realtime       │   │
│  └───────────┬──────────────────────────────────────────────────────────┘   │
│              │                                                                │
│  ┌───────────▼──────────────────────────────────────────────────────────┐   │
│  │  SERVICE LAYER                                                        │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │   │
│  │  │  Schema Analyzer │  │  Realtime Monitor │  │  Intelligence Hub  │   │   │
│  │  │  · Auto-introspect│ │  · WebSocket mgr  │  │  · Health scoring  │   │   │
│  │  │  · FK mapping    │  │  · Anomaly Z-score│  │  · Pattern detect  │   │   │
│  │  │  · PageRank      │  │  · TPS tracking   │  │  · Root cause      │   │   │
│  │  └────────┬─────────┘  └────────┬──────────┘  └────────┬──────────┘   │   │
│  │           │                     │                       │               │   │
│  │  ┌────────▼─────────┐  ┌────────▼──────────┐  ┌────────▼──────────┐   │   │
│  │  │  ML Analysis      │  │  Chat Service     │  │  Gravity Engine   │   │   │
│  │  │  · Classification │  │  · Gemini 2.0     │  │  · Node scoring   │   │   │
│  │  │  · Regression     │  │  · SQL generation │  │  · Entropy calc   │   │   │
│  │  │  · Clustering     │  │  · Groq fallback  │  │  · Latent space   │   │   │
│  │  │  · Time Series    │  │                   │  │  · PCA reduction  │   │   │
│  │  └────────┬─────────┘  └───────────────────┘  └───────────────────┘   │   │
│  └───────────┼──────────────────────────────────────────────────────────┘   │
│              │                                                                │
│  ┌───────────▼──────────────────────────────────────────────────────────┐   │
│  │  DATA LAYER                                                           │   │
│  │                                                                       │   │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │   │
│  │  │  PostgreSQL  │   │    MySQL      │   │   MongoDB    │             │   │
│  │  │  asyncpg     │   │   aiomysql    │   │   pymongo    │             │   │
│  │  └──────────────┘   └──────────────┘   └──────────────┘             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Level 2: Real-Time Data Flow

```
User types: "Which tables are causing anomalies?"
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                  │
│  AI Chat Component → POST /api/chat                                       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTP request + session context
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  chat_service.py                                                          │
│  1. Build system prompt with live schema context (table names, counts)    │
│  2. Call Gemini 2.0-flash-lite with full conversation history             │
│  3. Parse intent → extract SQL if needed                                  │
│  4. Execute SQL via db_connector.query()                                  │
│  5. Format response with anomaly data from realtime_monitor cache         │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
                     ┌──────────────┐
                     │  Response    │ ← Gemini 2.0 structured output
                     │  rendered in │   with live DB results
                     │  markdown    │
                     └──────────────┘

Simultaneously (WebSocket, every 30 seconds):
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  realtime/monitor.py  (background asyncio task)                          │
│  1. Query TPS, row counts, connection stats from DB                      │
│  2. Z-score anomaly detection on 200-point rolling baseline              │
│  3. IQR outlier flagging per table                                       │
│  4. Broadcast via WebSocket → updates 3D node glow in real-time          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Level 3: Intelligence Hub Analysis Flow (10 Tabs)

```
User selects table → clicks any Intelligence Hub tab
      │
      ▼
GET /api/intelligence/hub/{connection_id}/{table_name}
      │
      ▼ asyncio.gather (parallel, 25s timeout)
      │
      ├── Health Analysis
      │   └── monitor.py → TPS, latency, connection count, error rate
      │       → Composite health score (0–100)
      │
      ├── Anomaly Detection
      │   └── data_intelligence_analyzer.py
      │       → Z-score on numeric columns (sample: 500 rows)
      │       → IQR outlier count, null rate, cardinality
      │
      ├── Pattern Analysis
      │   └── pattern_analyzer.py
      │       → Hourly query cycle (GROUP BY HOUR)
      │       → Weekly seasonality (GROUP BY DAYOFWEEK)
      │       → Structural patterns (index coverage, FK depth)
      │
      ├── Forecast
      │   └── data_intelligence_analyzer.py → _analyze_growth()
      │       → numpy polyfit linear trend on row_count history
      │       → 30-day growth projection
      │
      ├── Impact Analysis
      │   └── root_cause_analyzer.py
      │       → FK dependency traversal (upstream + downstream)
      │       → Cascade risk scoring
      │       → pg_constraint / INFORMATION_SCHEMA queries (parameterized)
      │
      └── Recommendations
          └── realtime_monitor.get_realtime_data()
              → Health + anomaly context
              → Gemini 2.0 generates actionable recommendations
      │
      ▼
Frontend renders 10 tabs:
Health · Search · Ontology · Diagnose · Patterns · Risks ·
Forecast · Impact · Actions · Utils
```

---

### Level 4: ML Analysis Pipeline (Work on Data)

```
User: selects table + algorithm + target column → clicks "Run Model"
      │
      ▼
POST /api/ml/analyze
{
  connection_id, table, family: "regression",
  algo: "xgboost", target: "revenue", features: ["units","region"]
}
      │
      ▼
ml_analysis.py
      │
      ├── 1. Data Fetch
      │   └── _fetch_data() → safely-quoted SQL (no injection)
      │       → SELECT "units","region","revenue" FROM "sales" LIMIT 2000
      │
      ├── 2. Preprocessing (asyncio thread pool)
      │   └── _preprocess()
      │       → pandas DataFrame
      │       → Numeric cols: median imputation
      │       → Categorical cols: LabelEncoder
      │       → nan_to_num safety pass
      │       → Returns: X (numpy), y (numpy), feature_names
      │
      ├── 3. Model Training (asyncio thread pool, CPU-bound)
      │   └── _run_regression() / _run_classification() / _run_clustering()
      │       / _run_timeseries()
      │       → sklearn train_test_split (80/20)
      │       → Fit selected algorithm
      │       → Evaluate on test set
      │
      ├── 4. Real Metrics
      │   Classification : accuracy, precision, recall, F1 (weighted)
      │   Regression     : R², RMSE, MAE from actual predictions
      │   Clustering     : silhouette_score (auto-k KMeans / auto-eps DBSCAN)
      │   Time Series    : MAPE, RMSE, MAE (harmonic regression + seasonality)
      │
      ├── 5. Real Feature Importances
      │   RF / GBM : model.feature_importances_
      │   Linear   : |model.coef_| normalized
      │   Logistic : mean(|coef_|) across classes
      │
      └── 6. Insights
          └── _build_insights() → data-driven text from actual metric values
              (no hardcoded strings, no random numbers)
      │
      ▼
Frontend ResultsPanel:
  Metrics grid · Feature importance bars (animated) ·
  Predictions chart · AI insights list
```

---

### Level 5: Autonomous Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AGENT SYSTEM (Current State)                                            │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  T0 — Voice Agent                                                │    │
│  │  Voice input → Speech-to-text → Intent classification            │    │
│  │  → Natural language DB navigation + schema queries               │    │
│  │  Intents: fraud, health, schema, relationships, optimization      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  T1 — Background Intelligence Agent                              │    │
│  │  Continuous analysis loop (every 60s):                           │    │
│  │  → Schema health scoring                                         │    │
│  │  → Anomaly pattern correlation                                   │    │
│  │  → Index optimization recommendations                            │    │
│  │  → Growth trend alerts                                           │    │
│  │  Powered by: Gemini 2.0-flash-lite                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  Current limitation: Both agents are database-scoped only.               │
│  They cannot reach beyond the connected DB into external services.        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## SECTION 3 — GOOGLE MCP AGENTS INTEGRATION PLAN

### The Distinction: MCP Servers vs. MCP Agents

This is important. The previous version of this document discussed **MCP Servers** — services that expose tools. We are proposing something more powerful:

**MCP Agents** — AI agents that *use* MCP as their tool-connection layer. Specifically:

| Concept | What It Is | Our Use |
|---|---|---|
| **MCP Server** | A service that exposes tools via MCP protocol (e.g., a BigQuery MCP server exposes `run_query`, `list_datasets` tools) | We connect to Google's official MCP servers as tool sources |
| **MCP Agent** | An AI agent that calls MCP tools to complete tasks | Our T0/T1 agents become Google-powered MCP agents |
| **Google ADK** | Google's Agent Development Kit — Python SDK for building agents that reason over tools | We use ADK to rebuild T0/T1 as production-grade Google agents |
| **Vertex AI Agent Engine** | Google Cloud's managed runtime for running agents at scale | Hosts our agents, handles scaling + sessions |

**What we're building:** Our T1 Background Intelligence Agent, rebuilt on Google ADK, running on Vertex AI Agent Engine, connected to Google MCP tool servers (BigQuery, Search, Workspace, Cloud SQL Toolbox). This is not adding a plugin — it is a full architectural upgrade of the agent layer to Google's production agent stack.

---

### Why Google ADK Over Custom Agent Code?

**Current T1 agent** is a custom asyncio loop with prompt engineering. It works, but:
- No state persistence across restarts
- No session management for multi-user scenarios
- No built-in tool calling framework
- No evaluation / monitoring infrastructure
- No replay / debugging capability

**Google ADK gives us:**
```
Custom Loop Today          →   Google ADK Agent
─────────────────────────────────────────────────
Manual prompt building     →   Structured tool schema + LLM tool-use
asyncio while loop         →   Managed event loop with session persistence
No state                   →   Built-in session storage (Firestore / in-memory)
Print statements           →   Structured trace + replay in Vertex AI
No scaling                 →   Vertex AI Agent Engine (auto-scaling)
Manual retry logic         →   Built-in retry + error handling
One model hardcoded        →   Model-agnostic (Gemini 2.0, 2.5, custom)
```

---

### Integration Architecture: Google MCP Agents

```
╔══════════════════════════════════════════════════════════════════════════════╗
║           LIVING DATA INTELLIGENCE — GOOGLE MCP AGENT ARCHITECTURE           ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│  USER INTERFACE (React 19 Frontend)                                          │
│  · Chat panel   · 3D graph   · Intelligence Hub   · Alerts                  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                    REST / WebSocket
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│  FASTAPI BACKEND  (orchestration layer)                                      │
│  Receives user requests → delegates to agent layer                           │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│  GOOGLE AGENT LAYER  (NEW — powered by Google ADK + Vertex AI)               │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  T1 Intelligence Agent  (rebuilt on Google ADK)                      │    │
│  │                                                                       │    │
│  │  Brain: Gemini 2.0 Flash (tool-use mode)                             │    │
│  │  Runtime: Vertex AI Agent Engine                                      │    │
│  │  Session: Firestore (persistent across restarts)                      │    │
│  │                                                                       │    │
│  │  Agent reasoning loop:                                                │    │
│  │  1. Observe → receive DB health context + user intent                │    │
│  │  2. Plan    → decide which MCP tools to call                         │    │
│  │  3. Act     → call MCP tool servers in parallel                      │    │
│  │  4. Reflect → synthesize results, generate insight                   │    │
│  │  5. Respond → structured output to FastAPI / WebSocket               │    │
│  └────────────┬───────────────────────────────────────────────────────┘    │
│               │  calls tools via MCP protocol                                │
│               │                                                               │
│               ├──────────────────────────────────────────────────┐           │
│               │                                                   │           │
│    ┌──────────▼──────────┐  ┌───────────────────┐  ┌────────────▼────────┐  │
│    │  Google MCP Toolbox  │  │  BigQuery MCP      │  │  Google Search MCP  │  │
│    │  for Databases       │  │                    │  │                      │  │
│    │  (Cloud SQL,         │  │  · run_query       │  │  · web_search        │  │
│    │   AlloyDB, Spanner)  │  │  · list_datasets   │  │  · news_search       │  │
│    │  · execute_sql       │  │  · create_table    │  │  · grounding         │  │
│    │  · list_tables       │  │  · bqml_forecast   │  │                      │  │
│    │  · get_schema        │  │                    │  │                      │  │
│    └──────────────────────┘  └───────────────────┘  └─────────────────────┘  │
│                                                                               │
│    ┌──────────────────────┐  ┌───────────────────┐  ┌─────────────────────┐  │
│    │  Workspace MCP        │  │  Cloud Storage     │  │  Vertex AI APIs     │  │
│    │                       │  │  MCP               │  │                      │  │
│    │  · create_sheet       │  │  · upload_object   │  │  · model inference   │  │
│    │  · send_email         │  │  · read_object     │  │  · vector search     │  │
│    │  · create_event       │  │  · list_objects    │  │  · embeddings        │  │
│    └──────────────────────┘  └───────────────────┘  └─────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  T0 Voice Agent  (rebuilt on Google ADK, speech-first)              │    │
│  │  Google Speech-to-Text → Gemini intent → MCP tools → TTS response   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Agent Capability: Before vs. After

**Scenario: User asks — "What's wrong with my database and what should I do?"**

```
BEFORE (Current T1 Agent — database-scoped only):
─────────────────────────────────────────────────
T1 → reads schema + anomaly cache
   → "Table 'transactions' has anomalous TPS (Z-score: 3.4).
      Row count: 847,203. Recommended: add index on 'created_at'."

   Context: only what's in the connected DB.
   Actions: text recommendation only.

─────────────────────────────────────────────────

AFTER (Google ADK Agent — MCP-connected):
─────────────────────────────────────────────────
T1 → reads schema + anomaly cache
   → calls BigQuery MCP: "export 90-day anomaly history for 'transactions'"
   → runs BigQuery ML ARIMA_PLUS forecast: "next spike in ~4 days"
   → calls Google Search MCP: "PostgreSQL transactions table TPS spike pattern"
   → calls Workspace MCP: create_sheet("DB Anomaly Report — March 2026")
   → calls Workspace MCP: send_email(dba_team, "Action needed: transactions table")
   → calls GCS MCP: upload_object("reports/2026-03-20-analysis.json")

   Response:
   "Table 'transactions' has a Z-score 3.4 TPS anomaly detected today.

    Historical context (BigQuery, last 90 days): This pattern has occurred
    3 times — always 1–2 days before billing cycle close. Based on ARIMA
    forecast, expect a larger spike in 4 days (±1.2 days, 87% confidence).

    I found a relevant community thread via Google Search: PostgreSQL
    payment systems of your scale (800K–1M rows) commonly experience this
    with unoptimized batch queries on the billing close job.

    Actions taken:
    ✓ Full anomaly report exported to Google Sheets (link: ...)
    ✓ Email sent to dba@yourcompany.com with index optimization SQL
    ✓ Calendar alert created for March 24 (4 days out)
    ✓ Analysis archived to Cloud Storage

    Recommended SQL: CREATE INDEX CONCURRENTLY idx_trx_created_at
                     ON transactions (created_at) WHERE status = 'pending';"
```

**That is not a chatbot. That is a fully autonomous database intelligence analyst.**

---

### ADK Agent Implementation Plan

#### Agent A: T1 — Background Database Intelligence Agent

```python
# backend/agents/t1_intelligence_agent.py
# Built with Google ADK

from google.adk.agents import Agent
from google.adk.tools.mcp import MCPToolset, StdioServerParameters

t1_agent = Agent(
    name="database_intelligence_analyst",
    model="gemini-2.0-flash",
    description="Autonomous agent for database health, anomaly detection, and predictive intelligence",
    instruction="""
    You are an expert database intelligence analyst for the Living Data Intelligence Platform.

    Your responsibilities:
    1. Monitor database health and detect anomalies proactively
    2. Cross-reference anomalies with historical BigQuery data
    3. Enrich findings with real-world context via Google Search
    4. Generate reports and notify teams via Google Workspace
    5. Forecast future issues before they impact production

    Always: cite your data sources, quantify confidence, propose concrete SQL actions.
    """,
    tools=[
        # Our platform's own tools
        db_health_tool,           # reads realtime_monitor data
        schema_analysis_tool,     # reads schema_analyzer cache
        ml_forecast_tool,         # calls our /api/ml/analyze endpoint

        # Google MCP tools
        MCPToolset(StdioServerParameters(
            command="npx", args=["-y", "@modelcontextprotocol/server-bigquery"]
        )),
        MCPToolset(StdioServerParameters(
            command="npx", args=["-y", "@modelcontextprotocol/server-google-search"]
        )),
        MCPToolset(StdioServerParameters(
            command="python", args=["-m", "mcp_toolbox_for_databases"]
        )),
        workspace_toolset,        # Sheets, Gmail, Calendar
        gcs_toolset,              # Cloud Storage
    ]
)
```

#### Agent B: T0 — Voice-First Query Agent

```python
# backend/agents/t0_voice_agent.py
from google.adk.agents import Agent

t0_agent = Agent(
    name="voice_database_navigator",
    model="gemini-2.0-flash",
    description="Voice-first agent for natural language database navigation",
    instruction="""
    Convert natural language questions into precise database queries.
    Use the available tools to answer questions about schema, relationships,
    and performance. Keep answers concise and actionable.
    """,
    tools=[
        schema_analysis_tool,
        nl_to_sql_tool,           # wraps our chat_service.py
        anomaly_lookup_tool,      # reads from realtime_monitor
        MCPToolset(bigquery_params),
    ]
)
```

#### Vertex AI Agent Engine Deployment

```python
# backend/agents/deploy.py
from vertexai import agent_engines

# Deploy T1 as a managed Vertex AI agent
deployed_t1 = agent_engines.create(
    agent_engine=t1_agent,
    requirements=["google-cloud-aiplatform", "google-adk", "mcp"],
    display_name="LDI T1 Intelligence Agent",
    description="Database intelligence analyst with MCP tool access",
)
```

---

### Files to Create / Modify

| File | Status | Description |
|---|---|---|
| `backend/agents/t1_intelligence_agent.py` | NEW | ADK T1 agent definition |
| `backend/agents/t0_voice_agent.py` | NEW | ADK T0 voice agent definition |
| `backend/agents/deploy.py` | NEW | Vertex AI Agent Engine deployment script |
| `backend/agents/tools/db_health_tool.py` | NEW | ADK tool wrapping realtime_monitor |
| `backend/agents/tools/schema_analysis_tool.py` | NEW | ADK tool wrapping schema_analyzer |
| `backend/agents/tools/ml_forecast_tool.py` | NEW | ADK tool wrapping /api/ml/analyze |
| `backend/agents/mcp_config.py` | NEW | MCP server connection configs |
| `backend/app/api/agents.py` | MODIFY | Add Vertex AI Agent Engine endpoints |
| `backend/requirements.txt` | MODIFY | Add google-adk, google-cloud-aiplatform |

---

### TF-GNN Integration (Production Graph ML)

Alongside the agent upgrade, we replace the disabled PyTorch GAT with Google's TF-GNN:

```
Current State                    →    After Integration
─────────────────────────────────────────────────────────
gnn_model.py (PyTorch, disabled) →    tf_gnn_model.py (TF-GNN, always-on)
No training pipeline             →    Vertex AI Pipelines (TFX)
No model versioning              →    Vertex AI Model Registry
scikit-learn anomaly detection   →    TF Autoencoder (learns behavioral baselines)
No browser-side ML               →    TensorFlow.js (zero-latency 3D predictions)
```

---

## SECTION 4 — GOOGLE CLOUD STARTUP CREDITS PITCH

### Why We're Applying

We are at the inflection point between **impressive demo** and **enterprise-grade product**. The technical foundation is built. The Google integrations are designed in detail. What bridges the gap is access to Google Cloud infrastructure for:

1. **Training** the TF-GNN model on real accumulated graph snapshots
2. **Running** Vertex AI Agent Engine for our T0/T1 agents at production scale
3. **BigQuery** as the analytics backbone for cross-database intelligence
4. **Cloud Storage** for model artifact persistence
5. **Vertex AI Endpoints** for sub-10ms ML inference SLAs

Without credits, all of these fall back to local containers running on development hardware — which works for demos but cannot serve enterprise customers with SLA requirements.

---

### Startup Credits Request

| Program | Amount | Use |
|---|---|---|
| Google Cloud for Startups | $200,000 credit (2-year) | Full platform infrastructure + Vertex AI |
| Google for Startups Accelerator | Program + $3,000 GCP | Community + baseline credits |
| Gemini API Startup Program | Extended Gemini API quota | Production AI chat + agent reasoning |
| **Total requested** | **$200,000 + quota** | **6–12 months runway to Series A** |

---

### Credit Allocation Plan

| Google Cloud Service | Monthly Estimate | Purpose |
|---|---|---|
| Vertex AI Agent Engine (T1 + T0) | $300–800/mo | Production agent runtime, session management |
| Vertex AI Training (TF-GNN, Autoencoder) | $100–300/mo | Monthly model retraining jobs |
| Vertex AI Endpoints (2 endpoints) | $200–400/mo | GNN inference + anomaly model serving |
| Vertex AI Pipelines (TFX) | $50–100/mo | Automated retraining on drift |
| BigQuery (10TB scanned/mo) | $50–100/mo | Cross-DB analytics, ARIMA forecasting |
| Cloud Storage (500GB) | $10–15/mo | Models, snapshots, reports |
| Gemini API (production volume) | $200–500/mo | Chat + agent reasoning at scale |
| Cloud Run (API serving) | $50–150/mo | Scalable FastAPI deployment |
| Cloud SQL (Neon alt, managed PG) | $100–200/mo | Platform's own metadata storage |
| Firestore | $20–50/mo | Agent session persistence |
| Secret Manager | $5/mo | Credential management |
| Cloud Pub/Sub | $10/mo | Real-time anomaly alert pipeline |
| **Total Monthly** | **$1,095–$2,620/mo** | — |
| **12-month Total** | **$13,140–$31,440** | Well within $200K ask |

**The remainder (~$170K) funds the scaling phase** — onboarding first 50 enterprise customers, Vertex AI A/B testing, multi-region deployment, and compliance infrastructure (SOC 2).

---

### What Google Gets in Return

We commit to these deliverables as part of the credit partnership:

1. **Reference architecture** — Open-source the Google ADK + TF-GNN + MCP integration as a documented reference implementation under Apache 2.0. Currently no public production example of this stack exists.

2. **Case study** — Allow Google to publish an anonymized case study: "How Living Data Intelligence Platform uses Vertex AI Agent Engine + TF-GNN for enterprise database intelligence."

3. **Gemini showcase** — Platform is a live showcase of Gemini 2.0 in production use (AI chat, SQL generation, agent reasoning, schema enrichment). Available for Google marketing use with permission.

4. **Vertical template** — Our architecture becomes a template for Google Cloud solutions in the **Database Intelligence** vertical (banking, healthcare, e-commerce all have this problem).

5. **Community talks** — Speak at Google Cloud Next, Google for Startups events about the ADK + MCP agent architecture.

---

## SECTION 5 — BUSINESS VALUE, SCOPE & FUTURE ROADMAP

### Target Market & Buyer

**Primary Buyer:** Platform Engineering Team / Data Platform Lead at mid-to-large enterprises

**Company Profile:**
- 200–5,000 employees
- 20–200+ database tables across 3–10 services
- Spending $50K–$150K/year on monitoring (DataDog, New Relic) + schema tools
- Has had ≥1 data incident in the last 12 months that impacted revenue

**Verticals (Priority Order):**
1. **Fintech / Banking** — high-volume transaction DBs, regulatory anomaly detection needs
2. **SaaS / B2B Software** — multi-tenant databases, schema complexity growth with scale
3. **Healthcare / MedTech** — patient data integrity, audit trail intelligence
4. **E-commerce / Retail** — seasonal traffic patterns, inventory DB health
5. **Logistics / Supply Chain** — complex relational schemas, real-time tracking DBs

---

### Competitive Landscape

| Competitor | What They Do | Our Differentiation |
|---|---|---|
| DataDog | Infrastructure + DB metrics monitoring | We understand *data*, not just metrics. 3D schema intelligence, not dashboards. |
| New Relic | APM + database performance | Agent-driven, AI-native. NL chat + autonomous recommendations. |
| DBeaver Pro | Database IDE + schema visualization | We're a living intelligence platform, not a query tool. Real-time AI, not static diagrams. |
| Redgate | Schema management + comparison | Our scope is broader: intelligence + ML + agents + collaboration. |
| Monte Carlo | Data observability | ML-native from day 1. We also serve non-data engineers. |
| Atlan | Data catalog | We're operational, not catalog. Real-time health, not documentation. |

**Our unique position:** The only platform that combines 3D live visualization + autonomous AI agents + real ML analysis + natural language query in a single product, deployable against any existing database without schema changes.

---

### Pricing Model

| Tier | Price | Included |
|---|---|---|
| **Starter** | $299/mo | 1 DB connection, 5 users, Intelligence Hub, AI chat |
| **Team** | $999/mo | 5 DB connections, 25 users, + ML analysis, Agent alerts |
| **Business** | $2,999/mo | 20 connections, unlimited users, + custom agents, BigQuery export |
| **Enterprise** | Custom ($6K–$20K/mo) | Unlimited + SLA, SSO, compliance, dedicated support |

**Land and expand model:** Start with 1 connection (Starter), expand to full database fleet (Business/Enterprise) as value is proven. Net Revenue Retention target: 140%.

---

### Revenue Projections

| Milestone | Timeline | Revenue |
|---|---|---|
| 10 paying Starter/Team customers | Month 6 | $5,000–$15,000 MRR |
| 30 customers (mix of tiers) | Month 12 | $30,000–$60,000 MRR |
| 100 customers | Month 18–24 | $120,000–$250,000 MRR |
| 250 customers (Series A milestone) | Month 30 | $400,000–$700,000 MRR |
| **ARR at 250 customers** | | **$4.8M–$8.4M ARR** |

---

### Future Product Roadmap

#### Phase 1 — Production Foundation (Months 1–3)
- [ ] Google ADK agent rebuild (T0 + T1) with Vertex AI Agent Engine
- [ ] TF-GNN production model replacing PyTorch (always-on)
- [ ] BigQuery MCP integration for cross-DB historical analytics
- [ ] Google Search MCP for schema context enrichment
- [ ] Cloud Run deployment (auto-scaling FastAPI)
- [ ] User authentication (Google OAuth 2.0 / Firebase Auth)

#### Phase 2 — Enterprise Features (Months 4–6)
- [ ] Workspace MCP: Sheets export, Gmail anomaly alerts, Calendar scheduling
- [ ] Multi-tenant architecture (schema isolation per customer)
- [ ] SSO integration (Google Workspace, Okta, Azure AD)
- [ ] BigQuery ML ARIMA_PLUS forecasting (T1 agent-driven)
- [ ] TensorFlow.js in-browser glow prediction (zero-latency 3D updates)
- [ ] Role-based access control (RBAC)

#### Phase 3 — Intelligence Expansion (Months 7–12)
- [ ] **Schema migration intelligence** — agent suggests migration paths, predicts risk
- [ ] **Cross-database JOIN optimizer** — agent identifies cross-DB query optimization opportunities
- [ ] **Compliance intelligence** — GDPR/HIPAA data classification via agent + Vertex AI
- [ ] **Self-healing agents** — T1 can propose and (with approval) execute index optimizations
- [ ] **Mobile companion app** — React Native, receives anomaly push notifications
- [ ] **Slack / Teams integration** — agent sends alerts to team channels
- [ ] **API marketplace** — third parties can build plugins on our agent framework

#### Phase 4 — Platform Intelligence Network (Year 2)
- [ ] **Federated schema graph** — opt-in anonymized benchmarking across customer fleet
- [ ] **Industry patterns library** — "Your e-commerce DB matches 87% of high-performing Shopify-scale schemas"
- [ ] **Predictive incident prevention** — 72-hour advance warning using cross-fleet ML patterns
- [ ] **GNN knowledge transfer** — pre-trained graph model weights shared across customers
- [ ] **Vertex AI custom model per enterprise** — each customer gets a fine-tuned intelligence model

---

## SECTION 6 — ROI ANALYSIS

### ROI for Enterprise Customers

**Scenario: Mid-size SaaS company, 80 database tables, 3 developers on the data platform team**

| Cost Item | Without Platform | With Platform | Annual Saving |
|---|---|---|---|
| DBA time on anomaly investigation | 3 hrs/week × $120/hr × 52 | Automated alerts + root cause | **$18,720** |
| New engineer DB onboarding | 3 months × $15K/month salary × 2 hires/yr | 3D visual reduces to 2 weeks | **$22,500** |
| Data incidents (avg 2/year, $50K impact each) | $100,000 | Early warning reduces to 0.5/yr | **$75,000** |
| SQL dev requests (analyst→dev) | 8 hrs/week × $100/hr × 52 | NL chat handles 80% | **$33,280** |
| Schema documentation maintenance | 5 hrs/week × $80/hr × 52 | Auto-generated, always current | **$20,800** |
| **Total annual savings** | | | **$170,300** |
| **Platform cost (Business tier)** | | | **$35,988/yr** |
| **Net annual ROI** | | | **$134,312** |
| **ROI multiple** | | | **4.7× return** |

**Payback period: ~2.5 months**

---

### ROI for Google (Credits Investment)

**Google's investment:** $200,000 Google Cloud credits over 24 months
**Google's return:**

| Return Item | Value |
|---|---|
| Reference architecture for ADK + TF-GNN + MCP (no public example exists) | High strategic value — fills docs gap |
| Gemini 2.0 production usage at scale | Direct API revenue after credits expire |
| Vertex AI consumption (endpoints, training, agent engine) | Direct cloud revenue at scale |
| Case study + marketing rights for database intelligence vertical | ~$500K equivalent media value |
| 250 enterprise customers on Google Cloud stack | Cloud consumption expansion |
| Open-source Apache 2.0 implementation | Community adoption of Google AI stack |

**At 250 customers, each running:**
- Gemini API: ~$300/month × 250 = $75,000/month in API revenue to Google
- Vertex AI: ~$500/month × 250 = $125,000/month in Vertex AI revenue to Google
- **Google Cloud revenue from LDI customer fleet at scale: ~$2.4M/year**

**Credits ROI for Google: 12× over 3 years on direct cloud revenue alone.**

---

### ROI for Google (Startup Program Perspective)

The Google for Startups model is straightforward: invest credits in high-potential startups that will build on Google Cloud and eventually become significant cloud customers. Our metrics:

| Signal | Our Status |
|---|---|
| Already using Google AI (Gemini 2.0) | ✅ Live in production |
| Deep technical Google integration (ADK, TF-GNN, MCP) | ✅ Designed, ready to build |
| Clear B2B SaaS revenue model | ✅ Defined, realistic projections |
| Large addressable market | ✅ $3.4B database monitoring, $14.9B AI analytics |
| Committed to Google Cloud exclusively | ✅ No AWS/Azure in architecture |
| Open-source reference implementation | ✅ Committing as part of partnership |

---

## SECTION 7 — DISCUSSION TALKING POINTS

### "Why ADK agents instead of just calling Gemini directly?"

Our current T1 agent calls Gemini with a big prompt and parses the output manually. That works for demos. It does not work for enterprise customers who need:
- **Session persistence** — an agent that remembers what it told the DBA team last week
- **Tool reliability** — structured tool calling with retry logic and error recovery
- **Auditability** — every action logged, every tool call traceable
- **Multi-step reasoning** — plan→act→observe→reflect loop, not one-shot prompting
- **Scalability** — 100 simultaneous customer databases, each with their own agent loop

Google ADK solves all five. It is Google's production framework for exactly this use case. We would be building this functionality ourselves if ADK didn't exist — ADK means we build on proven infrastructure instead of reinventing it.

---

### "Why MCP agents specifically vs. direct API integration?"

Direct API integration means writing a new integration for every service — a BigQuery client, a Workspace client, a Search client, each with its own auth, error handling, and retry logic. We have already done this for our database connectors and it is significant maintenance overhead.

MCP is the standard. Google, Anthropic, Microsoft, and every major AI company has committed to it. Building our agents on MCP means:
1. Any new MCP-compatible service is automatically available to our agents
2. Our integration work is reusable — contribute back to the ecosystem
3. Enterprise customers can extend agents with their own internal MCP servers (CRM, ERP, ITSM)
4. The architecture does not lock customers into our specific service choices

When Google builds an MCP server for Google Maps, AlloyDB, or Vertex AI Feature Store — our agents can use it the next day. That is the compounding advantage of building on a standard.

---

### "What happens without the credits?"

**Technically:** Everything works. The demo is impressive. The agents run on local hardware.

**Commercially:** We cannot make enterprise sales commitments. No SLA without Vertex AI managed infrastructure. No multi-tenant isolation without Cloud Run auto-scaling. No cross-DB analytics without BigQuery. Every "can this scale?" question from an enterprise security team gets a complicated answer instead of "yes, it runs on Google Cloud."

**Competitively:** DataDog has $1.7B in annual revenue. They have full-time engineers building cloud integrations. The only way a startup competes is by building natively on the infrastructure that enterprise teams already trust and have already procured. That infrastructure is Google Cloud. Credits let us build the Google-native version of this platform fast enough to establish market position before better-funded competitors notice the opportunity.

**The risk of not funding:** We build on AWS or Azure instead. We are not in the Google ecosystem. Our customers are not Google Cloud customers. Google does not get the reference architecture, the case study, or the Vertex AI consumption. A $200K credits investment to prevent that outcome is a straightforward decision.

---

### "How do you think about competition from Google itself?"

Google builds platforms. We build vertical products on top of platforms. Google is not going to build a database intelligence platform for mid-market SaaS companies with 80 tables and a 3-person data team — that is not Google's business. Google builds Vertex AI, BigQuery, and ADK so that companies like us can build these vertical products. We are a distribution channel for Google Cloud to the mid-market enterprise segment that Google's direct sales team cannot economically reach.

This is the same model as Google Workspace → ISVs building on top. Or Android → third-party app developers. We expand Google's TAM in the enterprise database intelligence space. The partnership model is clear and well-precedented.

---

## APPENDIX: TECHNICAL PREREQUISITES

### Dependencies to Add

```bash
# Python backend
pip install google-adk>=0.1.0
pip install google-cloud-aiplatform>=1.60.0
pip install tensorflow-gnn>=0.6.0
pip install tensorflow>=2.16.0
pip install google-cloud-bigquery>=3.17.0
pip install google-cloud-storage>=2.16.0
pip install google-cloud-firestore>=2.16.0
pip install mcp>=1.3.0

# Frontend
npm install @tensorflow/tfjs @tensorflow/tfjs-backend-webgl
```

### Google Cloud APIs to Enable

```
✓ Vertex AI API                    (agent engine, training, endpoints)
✓ AI Platform API                  (Gemini, embeddings)
✓ BigQuery API                     (analytics, BQML)
✓ Cloud Storage API                (model artifacts, reports)
✓ Firestore API                    (agent session persistence)
✓ Cloud Run API                    (scalable API serving)
✓ Cloud Pub/Sub API                (anomaly alert pipeline)
✓ Google Workspace APIs            (Sheets, Gmail, Calendar)
✓ Google Search API                (context enrichment)
✓ Secret Manager API               (credential management)
✓ Cloud SQL Admin API              (MCP Toolbox for Databases)
```

### Environment Variables

```env
# Core Google Cloud
GOOGLE_CLOUD_PROJECT=ldi-production
GOOGLE_APPLICATION_CREDENTIALS=/secrets/service-account.json
VERTEX_AI_REGION=us-central1

# Vertex AI Agents
VERTEX_AI_AGENT_ENGINE_ID=...
T1_AGENT_RESOURCE_NAME=projects/.../agents/t1-intelligence-agent
T0_AGENT_RESOURCE_NAME=projects/.../agents/t0-voice-agent

# BigQuery
BIGQUERY_PROJECT=ldi-production
BIGQUERY_DATASET=ldi_analytics
BIGQUERY_ANOMALY_TABLE=anomaly_events
BIGQUERY_SNAPSHOT_TABLE=graph_snapshots

# Cloud Storage
GCS_BUCKET_MODELS=ldi-models-prod
GCS_BUCKET_SNAPSHOTS=ldi-graph-snapshots
GCS_BUCKET_REPORTS=ldi-reports

# Gemini (already present)
GOOGLE_API_KEY=...  # existing

# MCP
MCP_TOOLBOX_DB_HOST=127.0.0.1
MCP_TOOLBOX_DB_PORT=5000
```

---

## EXECUTIVE SUMMARY

| What We Have | What We're Building | What We Need |
|---|---|---|
| Live 3D database visualization (React + Three.js) | Google ADK-powered T0/T1 agents | Vertex AI Agent Engine credits |
| Real ML analysis (sklearn: classification, regression, clustering, time series) | TF-GNN production graph model on Vertex AI | Vertex AI Training + Endpoints credits |
| AI chat with Gemini 2.0 (live today) | BigQuery MCP analytics across all connected DBs | BigQuery processing credits |
| Real-time anomaly detection via WebSocket | Cloud Storage for model artifact persistence | GCS credits |
| 10-tab Intelligence Hub (production grade) | Google Workspace alerts and collaboration | Workspace API access |
| FastAPI backend, Docker, multi-DB support | Cloud Run auto-scaling deployment | Cloud Run credits |

**The ask:** $200,000 Google Cloud credits over 24 months via the Google for Startups program.
**The commitment:** Apache 2.0 reference implementation of Google ADK + TF-GNN + MCP agents. Published case study. Committed to Google Cloud exclusively.
**The return:** A production showcase of Google's enterprise AI stack, ~$2.4M/year in Google Cloud consumption at 250 customers, and a replicable architecture for the $18.3B database intelligence market.

---

*Document: Living Data Intelligence Platform — Google Partnership & Startup Credits Proposal*
*Branch: `sasir` | Repository: `living-data-intelligence-backend-sasir`*
*Prepared: March 2026*
