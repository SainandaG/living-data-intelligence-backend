# MCP Integration Guide — Living Data Intelligence Platform

## Table of Contents

1. [What is MCP?](#1-what-is-mcp)
2. [Why MCP Matters for This Project](#2-why-mcp-matters-for-this-project)
3. [Architecture Overview](#3-architecture-overview)
4. [Core Concepts](#4-core-concepts)
5. [Integration Strategy](#5-integration-strategy)
6. [MCP Server Implementation (Exposing Our Tools)](#6-mcp-server-implementation-exposing-our-tools)
7. [MCP Client Integration (Consuming External Servers)](#7-mcp-client-integration-consuming-external-servers)
8. [Transport Layer Options](#8-transport-layer-options)
9. [Tool-by-Tool Mapping](#9-tool-by-tool-mapping)
10. [Security Considerations](#10-security-considerations)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment](#12-deployment)
13. [Real-World Usage Scenarios](#13-real-world-usage-scenarios)
14. [Comparison: Before vs After MCP](#14-comparison-before-vs-after-mcp)
15. [Implementation Roadmap](#15-implementation-roadmap)

---

## 1. What is MCP?

**Model Context Protocol (MCP)** is an open standard created by Anthropic that defines how AI models communicate with external tools, data sources, and services. Think of it as **USB for AI** — a universal plug-and-play interface.

### The Problem MCP Solves

Without MCP, every AI integration requires custom code:

```
Claude Desktop  →  custom plugin  →  Your Database
Cursor          →  different plugin →  Your Database
Custom App      →  yet another API  →  Your Database
```

With MCP, one standard interface serves all clients:

```
Claude Desktop  ─┐
Cursor          ─┤── MCP Protocol ──→  Your MCP Server ──→ Your Database
VS Code         ─┤
Custom App      ─┘
```

### How MCP Works (Protocol Flow)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────────┐
│  MCP Client  │  JSON   │  MCP Server  │  calls  │  Your Backend    │
│  (AI model)  │ ──────→ │  (thin layer)│ ──────→ │  (existing code) │
│              │ ←────── │              │ ←────── │                  │
│  Sends:      │         │  Receives:   │         │  Executes:       │
│  - tool call │         │  - validates │         │  - DB queries    │
│  - params    │         │  - routes    │         │  - ML models     │
│              │         │  - returns   │         │  - Analysis      │
└──────────────┘         └──────────────┘         └──────────────────┘
```

**Key point:** MCP is a protocol (like HTTP), not a library. It defines the message format. The `mcp` Python package provides the server/client implementation.

---

## 2. Why MCP Matters for This Project

### Our Current Architecture

The Living Data Intelligence platform already has:

| Component | Location | What It Does |
|-----------|----------|-------------|
| `TOOL_REGISTRY` | `backend/app/services/apex_agent/tools/__init__.py` | 7 tools: schema inspector, data sampler, ML runner, anomaly detector, insight writer, action trigger |
| `AgentPlanner` | `backend/app/services/apex_agent/planner.py` | Converts natural language → structured execution plan |
| `AgentExecutor` | `backend/app/services/apex_agent/executor.py` | Runs plans step-by-step with parallel execution |
| `AgentMemory` | `backend/app/services/apex_agent/memory.py` | Per-session key-value fact store |

### What MCP Adds

| Benefit | Without MCP | With MCP |
|---------|-------------|----------|
| **External AI Access** | Only our frontend can use tools | Claude Desktop, Cursor, VS Code, any MCP client can use them |
| **Standardized Interface** | Custom `TOOL_REGISTRY` format | Industry-standard tool definitions with JSON Schema |
| **Discovery** | Client must know our API | AI models auto-discover available tools |
| **Composability** | Isolated platform | Our tools compose with thousands of other MCP servers |
| **Multi-Model Support** | Tied to Gemini/OpenAI in planner | Any MCP-aware model can orchestrate our tools |

### Concrete Value

1. **A data analyst opens Claude Desktop**, connects to our MCP server, and says "show me anomalies in the orders table" — our `AnomalyDetectorTool` runs directly
2. **A developer in Cursor** asks "what's the schema of the production database?" — our `SchemaInspectorTool` responds
3. **An executive uses Claude.ai** and says "give me a churn forecast" — our full ML pipeline executes
4. **Another AI agent** in a different system can call our tools as part of a larger workflow

---

## 3. Architecture Overview

### Where MCP Fits

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP CLIENTS                             │
│                                                             │
│  ┌─────────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐ │
│  │Claude Desktop│  │ Cursor  │  │ VS Code  │  │Custom App│ │
│  └──────┬──────┘  └────┬────┘  └────┬─────┘  └────┬─────┘ │
└─────────┼──────────────┼────────────┼──────────────┼───────┘
          │              │            │              │
          └──────────────┴─────┬──────┴──────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   MCP TRANSPORT     │
                    │  stdio / SSE / HTTP │
                    └──────────┬──────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     MCP SERVER (NEW)                         │
│                  backend/app/mcp_server.py                   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Tool Definitions (JSON Schema for each tool)         │  │
│  │  Resource Definitions (database schemas, metadata)     │  │
│  │  Prompt Templates (analysis templates)                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│            ┌─────────────▼─────────────┐                    │
│            │    Adapter Layer           │                    │
│            │  Maps MCP calls → Tools   │                    │
│            └─────────────┬─────────────┘                    │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│               EXISTING BACKEND (UNCHANGED)                   │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │TOOL_REGISTRY│  │AgentPlanner  │  │AgentExecutor       │ │
│  │ 7 tools     │  │LLM + rules   │  │Parallel step runner│ │
│  └─────────────┘  └──────────────┘  └────────────────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │AgentMemory  │  │DB Connector  │  │Schema Analyzer     │ │
│  │Session store│  │Multi-DB      │  │Live inspection     │ │
│  └─────────────┘  └──────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### File Structure After Integration

```
backend/
├── app/
│   ├── mcp_server.py              ← NEW: MCP server entry point
│   ├── mcp/                       ← NEW: MCP module
│   │   ├── __init__.py
│   │   ├── tools.py               ← Tool definitions wrapping TOOL_REGISTRY
│   │   ├── resources.py           ← Resource definitions (schemas, metadata)
│   │   ├── prompts.py             ← Reusable prompt templates
│   │   └── auth.py                ← MCP-level authentication
│   ├── services/
│   │   └── apex_agent/            ← EXISTING: unchanged
│   │       ├── tools/
│   │       ├── planner.py
│   │       ├── executor.py
│   │       └── memory.py
│   └── ...
├── requirements.txt               ← ADD: mcp>=1.0.0
└── mcp_config.json                ← NEW: Claude Desktop config example
```

---

## 4. Core Concepts

MCP defines three primitives that a server can expose:

### 4.1 Tools (Functions the AI Can Call)

Tools are executable functions with typed parameters. The AI model decides when to call them.

```python
# Our SchemaInspectorTool becomes an MCP tool:
{
    "name": "inspect_schema",
    "description": "Inspect database schema — discovers tables, columns, relationships, and entity types",
    "inputSchema": {
        "type": "object",
        "properties": {
            "connection_id": {
                "type": "string",
                "description": "Database connection identifier"
            },
            "table_name": {
                "type": "string",
                "description": "Specific table to inspect (optional, inspects all if omitted)"
            }
        },
        "required": ["connection_id"]
    }
}
```

**Mapping to our project:** Each tool in `TOOL_REGISTRY` becomes an MCP tool definition.

### 4.2 Resources (Data the AI Can Read)

Resources are read-only data endpoints. The AI can browse them like files.

```python
# Expose database schema as a resource:
{
    "uri": "schema://production/tables",
    "name": "Production Database Schema",
    "description": "Live schema of the connected production database",
    "mimeType": "application/json"
}
```

**Mapping to our project:** Database schemas, cached analysis results, entity maps, and session memory can all be exposed as resources.

### 4.3 Prompts (Reusable Templates)

Prompts are pre-built conversation templates that guide the AI through specific workflows.

```python
# A churn analysis prompt template:
{
    "name": "churn_analysis",
    "description": "Run a full churn analysis pipeline on a database",
    "arguments": [
        {"name": "connection_id", "required": true},
        {"name": "target_column", "required": false}
    ]
}
```

**Mapping to our project:** Each plan type in `AgentPlanner._rule_plan()` (churn, anomaly, forecast, segment) becomes an MCP prompt template.

---

## 5. Integration Strategy

### Two-Phase Approach

#### Phase 1: MCP Server (Expose Our Tools)

**Goal:** Any MCP client can use our data intelligence tools.

| Priority | Tool | MCP Mapping |
|----------|------|------------|
| P0 | `inspect_schema` | `tool: inspect_schema` + `resource: schema://{connection_id}/tables` |
| P0 | `sample_data` | `tool: sample_data` |
| P0 | `detect_anomalies` | `tool: detect_anomalies` |
| P1 | `run_ml` / `run_automl` | `tool: run_ml`, `tool: run_automl` |
| P1 | `write_insight` | `tool: write_insight` |
| P2 | `trigger_decision` | `tool: trigger_decision` (requires approval flow) |
| P2 | Full pipeline | `prompt: churn_analysis`, `prompt: anomaly_scan`, `prompt: forecast` |

#### Phase 2: MCP Client (Consume External Servers)

**Goal:** Our `AgentExecutor` can call external MCP servers for additional capabilities.

| External Server | What It Provides | Use Case |
|----------------|-----------------|----------|
| Filesystem MCP | Read/write files | Export reports as files |
| Slack MCP | Send messages | Alert on critical anomalies |
| GitHub MCP | Create issues | Auto-file data quality issues |
| Google Drive MCP | Store documents | Archive analysis reports |
| PostgreSQL MCP | Direct DB access | Alternative to our db_connector |

---

## 6. MCP Server Implementation (Exposing Our Tools)

### Step 1: Install Dependencies

Add to `backend/requirements.txt`:

```
mcp>=1.0.0
```

### Step 2: Create the MCP Server

```python
# backend/app/mcp_server.py
"""
MCP Server for Living Data Intelligence Platform.

Exposes the APEX agent's tools as MCP-compatible tools that any
MCP client (Claude Desktop, Cursor, VS Code, etc.) can discover and call.
"""

from mcp.server.fastmcp import FastMCP
from app.services.apex_agent.tools import TOOL_REGISTRY
from app.services.apex_agent.memory import AgentMemory

import json
import uuid

# ── Server instance ──────────────────────────────────────────

mcp = FastMCP(
    name="living-data-intelligence",
    version="1.0.0",
)


# ── Helper: collect async generator results ──────────────────

async def _collect_tool_results(tool, params: dict, connection_id: str) -> dict:
    """Run a TOOL_REGISTRY tool and collect all yielded events into a single result."""
    session_id = str(uuid.uuid4())
    memory = AgentMemory(session_id)

    events = []
    result_data = {}
    error_text = None

    async for event in tool.execute(params, memory, connection_id):
        events.append(event)
        if event.get("type") == "result":
            result_data = event.get("data", {})
        elif event.get("type") == "error":
            error_text = event.get("text", "Unknown error")

    if error_text:
        return {"error": error_text}

    last_text = next(
        (e["text"] for e in reversed(events) if "text" in e),
        "Tool completed"
    )

    return {
        "summary": last_text,
        "data": result_data,
    }


# ── Tool: inspect_schema ─────────────────────────────────────

@mcp.tool()
async def inspect_schema(connection_id: str) -> str:
    """Inspect database schema — discovers all tables, columns, relationships,
    row counts, and auto-detects entity types (customer, order, product, etc.).

    Args:
        connection_id: The database connection identifier to inspect.

    Returns:
        JSON with tables, relationships, entity_map, and table_count.
    """
    tool = TOOL_REGISTRY["inspect_schema"]
    result = await _collect_tool_results(
        tool, {"connection_id": connection_id}, connection_id
    )
    return json.dumps(result, indent=2, default=str)


# ── Tool: sample_data ────────────────────────────────────────

@mcp.tool()
async def sample_data(
    connection_id: str,
    table: str = "",
    limit: int = 2000,
) -> str:
    """Sample rows from a database table and profile the columns.
    Returns numeric/categorical/date column breakdown, null percentages, and shape.

    Args:
        connection_id: The database connection identifier.
        table: Table name to sample (uses auto-detected primary table if empty).
        limit: Max rows to sample (capped at 5000).

    Returns:
        JSON with row_count, column profile (numeric, categorical, dates, nulls).
    """
    tool = TOOL_REGISTRY["sample_data"]
    params = {"connection_id": connection_id, "limit": limit}
    if table:
        params["table"] = table
    result = await _collect_tool_results(tool, params, connection_id)
    return json.dumps(result, indent=2, default=str)


# ── Tool: detect_anomalies ───────────────────────────────────

@mcp.tool()
async def detect_anomalies(
    connection_id: str,
    sensitivity: str = "medium",
) -> str:
    """Run statistical anomaly detection (Z-score + IQR) on sampled data.
    Must run sample_data first.

    Args:
        connection_id: The database connection identifier.
        sensitivity: Detection sensitivity — "low", "medium", or "high".

    Returns:
        JSON with anomalies list (column, value, z_score, severity),
        column_stats, and counts (total, critical, warning).
    """
    tool = TOOL_REGISTRY["detect_anomalies"]
    result = await _collect_tool_results(
        tool, {"sensitivity": sensitivity}, connection_id
    )
    return json.dumps(result, indent=2, default=str)


# ── Tool: run_ml ─────────────────────────────────────────────

@mcp.tool()
async def run_ml(
    connection_id: str,
    family: str = "auto",
    algo: str = "auto",
    target: str = "",
) -> str:
    """Run a machine learning experiment on sampled data.
    Supports classification, regression, clustering, and time-series.
    Must run sample_data first.

    Args:
        connection_id: The database connection identifier.
        family: ML family — "classification", "regression", "clustering", "timeseries", or "auto".
        algo: Algorithm to use or "auto" for default selection.
        target: Target column for supervised learning (auto-detected if empty).

    Returns:
        JSON with algorithm used, metrics (F1/R2/silhouette), feature importances, and insights.
    """
    tool = TOOL_REGISTRY["run_ml"]
    params = {"family": family, "algo": algo}
    if target:
        params["target"] = target
    result = await _collect_tool_results(tool, params, connection_id)
    return json.dumps(result, indent=2, default=str)


# ── Tool: run_automl ─────────────────────────────────────────

@mcp.tool()
async def run_automl(
    connection_id: str,
    family: str = "auto",
    target: str = "",
) -> str:
    """Run AutoML — automatically selects the best algorithm by trying
    top candidates and picking the highest-scoring one. Must run sample_data first.

    Args:
        connection_id: The database connection identifier.
        family: ML family — "classification", "regression", "clustering", "timeseries", or "auto".
        target: Target column for supervised learning (auto-detected if empty).

    Returns:
        JSON with best algorithm, metrics, feature importances, and insights.
    """
    tool = TOOL_REGISTRY["run_automl"]
    params = {"family": family}
    if target:
        params["target"] = target
    result = await _collect_tool_results(tool, params, connection_id)
    return json.dumps(result, indent=2, default=str)


# ── Tool: write_insight ──────────────────────────────────────

@mcp.tool()
async def write_insight(
    connection_id: str,
    audience: str = "business",
    include_recommendations: bool = True,
) -> str:
    """Synthesize all analysis results into a structured intelligence report.
    Uses LLM when available, falls back to template-based generation.
    Must run ML or anomaly detection first.

    Args:
        connection_id: The database connection identifier.
        audience: Target audience — "business", "ops", "marketing", or "technical".
        include_recommendations: Whether to include actionable recommendations.

    Returns:
        JSON with narrative report, key_findings, recommendations, top features.
    """
    tool = TOOL_REGISTRY["write_insight"]
    params = {"audience": audience, "include_recommendations": include_recommendations}
    result = await _collect_tool_results(tool, params, connection_id)
    return json.dumps(result, indent=2, default=str)


# ── Tool: trigger_decision ───────────────────────────────────

@mcp.tool()
async def trigger_decision(
    connection_id: str,
    severity: str = "auto",
    condition: str = "",
    requires_approval: bool = True,
) -> str:
    """Create a Decision record based on analysis results.
    Can auto-escalate severity based on anomaly findings.

    Args:
        connection_id: The database connection identifier.
        severity: "info", "warning", "high", "critical", or "auto" (derives from anomaly results).
        condition: Optional condition expression like "anomaly_count > 5".
        requires_approval: Whether the decision requires human approval before action.

    Returns:
        JSON with decision ID, title, severity, findings, and recommended actions.
    """
    tool = TOOL_REGISTRY["trigger_decision"]
    params = {
        "severity": severity,
        "condition": condition,
        "requires_approval": requires_approval,
    }
    result = await _collect_tool_results(tool, params, connection_id)
    return json.dumps(result, indent=2, default=str)


# ── Tool: full_analysis (orchestrated pipeline) ─────────────

@mcp.tool()
async def full_analysis(
    connection_id: str,
    query: str = "Run a full exploratory analysis",
) -> str:
    """Run a complete analysis pipeline: inspect schema → sample data →
    auto ML → anomaly detection → generate insight report.
    This is the equivalent of asking the APEX agent a question.

    Args:
        connection_id: The database connection identifier.
        query: Natural language description of what to analyze.

    Returns:
        JSON with the full analysis report including ML results, anomalies, and recommendations.
    """
    from app.services.apex_agent.planner import agent_planner
    from app.services.apex_agent.executor import AgentExecutor

    memory = AgentMemory(str(uuid.uuid4()))
    plan = await agent_planner.plan(query, memory.session_id, connection_id)
    executor = AgentExecutor()

    events = []
    async for event in executor.execute(plan, connection_id, memory):
        events.append(event)

    report = memory.get("final_report", {})
    plan_done = next((e for e in events if e.get("type") == "plan_done"), {})

    return json.dumps({
        "query": query,
        "intent": plan.intent,
        "steps_completed": plan_done.get("steps_done", 0),
        "elapsed_seconds": plan_done.get("elapsed_s", 0),
        "report": report,
    }, indent=2, default=str)


# ── Resources ────────────────────────────────────────────────

@mcp.resource("schema://{connection_id}/tables")
async def get_schema_resource(connection_id: str) -> str:
    """Live database schema for the given connection."""
    from app.services.schema_analyzer import schema_analyzer
    schema = schema_analyzer.get_analysis_result(connection_id)
    if not schema:
        return json.dumps({"error": "Schema not cached. Call inspect_schema tool first."})
    tables = []
    for t in (schema.tables if hasattr(schema, "tables") else []):
        tables.append({
            "name": t.name if hasattr(t, "name") else str(t),
            "row_count": t.row_count if hasattr(t, "row_count") else 0,
        })
    return json.dumps(tables, indent=2)


# ── Prompt Templates ─────────────────────────────────────────

@mcp.prompt()
def churn_analysis(connection_id: str) -> str:
    """Guide the AI through a complete churn analysis pipeline."""
    return f"""You are analyzing customer churn for database connection '{connection_id}'.

Follow these steps in order:
1. Call inspect_schema to discover tables and relationships
2. Call sample_data to load the most relevant customer/event table
3. Call run_automl with family="classification" to build a churn model
4. Call detect_anomalies to find unusual churn patterns
5. Call write_insight with audience="business" to generate the final report
6. If critical anomalies found, call trigger_decision with severity="auto"

After each step, explain what you found before proceeding to the next."""


@mcp.prompt()
def anomaly_scan(connection_id: str) -> str:
    """Guide the AI through anomaly detection."""
    return f"""You are scanning for anomalies in database '{connection_id}'.

Follow these steps:
1. Call inspect_schema to discover the schema
2. Call sample_data on the most active table
3. Call detect_anomalies with sensitivity="medium"
4. Call write_insight with audience="ops"
5. If critical anomalies found, call trigger_decision

Report each anomaly with its severity and business impact."""


@mcp.prompt()
def forecast(connection_id: str, metric: str = "revenue") -> str:
    """Guide the AI through time-series forecasting."""
    return f"""You are forecasting '{metric}' for database '{connection_id}'.

Follow these steps:
1. Call inspect_schema to find date and metric columns
2. Call sample_data with the relevant time-series table
3. Call run_ml with family="timeseries"
4. Call write_insight with audience="business"

Include confidence intervals and seasonal patterns in your explanation."""


# ── Entry point ──────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run()  # stdio transport for Claude Desktop
```

### Step 3: Mount with FastAPI (SSE Transport)

```python
# Add to your main FastAPI app (e.g., main.py or wherever app is created)

from starlette.routing import Mount
from mcp.server.sse import SseServerTransport

# Create SSE transport for web-based MCP clients
sse_transport = SseServerTransport("/mcp/messages/")

# Mount the SSE endpoint
app.router.routes.append(
    Mount("/mcp", app=sse_transport.get_asgi_app())
)
```

### Step 4: Claude Desktop Configuration

Create `mcp_config.json` for users to add to their Claude Desktop:

```json
{
  "mcpServers": {
    "living-data-intelligence": {
      "command": "python",
      "args": ["-m", "app.mcp_server"],
      "cwd": "/path/to/backend",
      "env": {
        "DATABASE_URL": "postgresql://...",
        "GOOGLE_API_KEY": "optional-for-llm-insights"
      }
    }
  }
}
```

On Windows, add this to: `%APPDATA%\Claude\claude_desktop_config.json`
On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

---

## 7. MCP Client Integration (Consuming External Servers)

This is Phase 2 — making our `AgentExecutor` able to call external MCP servers.

### Why?

Our agent currently has 7 internal tools. With MCP client support, it gains access to:

- **Filesystem MCP Server** → Read/write CSV exports, log files
- **Slack MCP Server** → Send anomaly alerts to channels
- **GitHub MCP Server** → Create issues for data quality problems
- **Google Drive MCP Server** → Archive reports
- **Brave Search MCP Server** → Enrich entity data with web context

### Implementation

```python
# backend/app/mcp/client.py
"""
MCP Client — allows our agent to consume external MCP servers.
"""

from mcp import ClientSession
from mcp.client.stdio import stdio_client

class MCPClientManager:
    """Manages connections to external MCP servers."""

    def __init__(self):
        self._sessions: dict[str, ClientSession] = {}

    async def connect(self, name: str, command: str, args: list[str]) -> None:
        """Connect to an external MCP server."""
        transport = await stdio_client(command, args)
        session = ClientSession(*transport)
        await session.initialize()
        self._sessions[name] = session

    async def list_tools(self, server_name: str) -> list:
        """List tools available on an external server."""
        session = self._sessions[server_name]
        result = await session.list_tools()
        return result.tools

    async def call_tool(self, server_name: str, tool_name: str, params: dict) -> str:
        """Call a tool on an external MCP server."""
        session = self._sessions[server_name]
        result = await session.call_tool(tool_name, params)
        return result.content[0].text

    async def disconnect_all(self) -> None:
        for session in self._sessions.values():
            await session.close()

# Singleton
mcp_client = MCPClientManager()
```

### Adding External Tools to TOOL_REGISTRY

```python
# backend/app/services/apex_agent/tools/mcp_bridge.py
"""
Bridge that makes external MCP server tools available to our AgentExecutor.
"""

from app.mcp.client import mcp_client

class MCPBridgeTool:
    """Wraps an external MCP tool so it looks like a local TOOL_REGISTRY tool."""

    def __init__(self, server_name: str, tool_name: str):
        self.server_name = server_name
        self.tool_name = tool_name
        self.name = f"mcp_{server_name}_{tool_name}"

    async def execute(self, params, memory, connection_id):
        result = await mcp_client.call_tool(
            self.server_name, self.tool_name, params
        )
        yield {
            "type": "result",
            "text": f"MCP tool {self.tool_name} completed",
            "data": {"result": result},
            "summary": f"External tool {self.server_name}/{self.tool_name} done",
        }
```

---

## 8. Transport Layer Options

MCP supports multiple transports. Choose based on your deployment:

| Transport | How It Works | Best For | Setup |
|-----------|-------------|----------|-------|
| **stdio** | Server runs as a subprocess, communicates via stdin/stdout | Claude Desktop (local) | `mcp.run()` |
| **SSE** (Server-Sent Events) | Server exposes HTTP endpoints, streams responses | Web clients, remote access | Mount on FastAPI |
| **Streamable HTTP** | Newer HTTP-based transport with bidirectional support | Production deployments | `mcp.run(transport="streamable-http")` |

### stdio (for Claude Desktop)

```python
# backend/app/mcp_server.py — bottom of file
if __name__ == "__main__":
    mcp.run()  # defaults to stdio
```

### SSE (for web clients)

```python
# Mount alongside your existing FastAPI app
from mcp.server.sse import SseServerTransport

sse = SseServerTransport("/mcp/messages/")

@app.get("/mcp/sse")
async def mcp_sse(request):
    async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
        await mcp._mcp_server.run(
            streams[0], streams[1], mcp._mcp_server.create_initialization_options()
        )
```

### Streamable HTTP (for production)

```python
if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8001)
```

---

## 9. Tool-by-Tool Mapping

How each existing tool maps to MCP:

### inspect_schema

| Aspect | Current | MCP |
|--------|---------|-----|
| Input | `params: Dict, memory: AgentMemory, connection_id: str` | `connection_id: str` (single typed param) |
| Output | AsyncGenerator yielding status/result/error events | Single JSON string response |
| Side Effects | Writes to `memory` (schema_tables, entity_map, etc.) | None (stateless per call) |
| Discovery | Hardcoded in TOOL_REGISTRY | Auto-discovered by any MCP client |

### sample_data

| Aspect | Current | MCP |
|--------|---------|-----|
| Input | `params.table`, `params.limit`, reads `memory.primary_table` | `connection_id`, `table`, `limit` (explicit params) |
| Output | AsyncGenerator with row count and column profile | JSON string with profile |
| Dependency | Needs `inspect_schema` to run first (for `primary_table` in memory) | Explicit: table param required, or runs inspect_schema internally |

### detect_anomalies

| Aspect | Current | MCP |
|--------|---------|-----|
| Input | Reads `memory.sample_rows` and `memory.column_profile` | `connection_id`, `sensitivity` |
| Output | Anomaly list with severity rankings | JSON with anomalies, stats, counts |
| Dependency | Needs `sample_data` (for rows in memory) | Adapter runs sample_data internally if needed |

### run_ml / run_automl

| Aspect | Current | MCP |
|--------|---------|-----|
| Input | `params.family`, `params.algo`, `params.target`, reads memory for features | `connection_id`, `family`, `algo`, `target` |
| Output | Metrics, feature importances, insights | JSON with full ML results |

### write_insight

| Aspect | Current | MCP |
|--------|---------|-----|
| Input | Reads all memory facts (ml_result, anomalies, entity_map, etc.) | `connection_id`, `audience`, `include_recommendations` |
| Output | Narrative report + structured findings | JSON with report |

### trigger_decision

| Aspect | Current | MCP |
|--------|---------|-----|
| Input | `params.severity`, `params.condition`, reads memory for report | `connection_id`, `severity`, `condition`, `requires_approval` |
| Output | Decision record | JSON with decision |
| Special | Dispatches to alert_engine | Same, but requires_approval defaults to True for safety |

---

## 10. Security Considerations

### Authentication

MCP itself doesn't enforce auth — you must add it:

```python
# backend/app/mcp/auth.py
"""
Authentication middleware for MCP server.
Validates API keys or JWT tokens before allowing tool execution.
"""

import os
from functools import wraps

VALID_API_KEYS = set(os.getenv("MCP_API_KEYS", "").split(","))

def require_auth(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # In SSE transport, auth comes from headers
        # In stdio transport, auth comes from env vars (trusted local process)
        api_key = kwargs.pop("_api_key", os.getenv("MCP_API_KEY", ""))
        if api_key not in VALID_API_KEYS and VALID_API_KEYS != {""}:
            return '{"error": "Unauthorized"}'
        return await func(*args, **kwargs)
    return wrapper
```

### Connection Access Control

Not every MCP client should access every database connection:

```python
ALLOWED_CONNECTIONS = {
    "readonly-prod": {"tools": ["inspect_schema", "sample_data", "detect_anomalies"]},
    "dev-sandbox":   {"tools": "*"},  # all tools allowed
}

def check_connection_access(connection_id: str, tool_name: str) -> bool:
    config = ALLOWED_CONNECTIONS.get(connection_id)
    if not config:
        return False
    allowed = config["tools"]
    return allowed == "*" or tool_name in allowed
```

### SQL Injection Prevention

Our tools already use parameterized queries via `db_connector`, but the MCP layer adds another validation point:

```python
import re

def validate_table_name(name: str) -> bool:
    """Only allow alphanumeric table names with underscores."""
    return bool(re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name))
```

### Rate Limiting

```python
from slowapi import Limiter
# Apply rate limits to MCP SSE endpoint
# Reuse existing SlowAPI configuration from the FastAPI app
```

---

## 11. Testing Strategy

### Unit Tests

```python
# backend/tests/test_mcp_server.py

import pytest
from app.mcp_server import mcp

@pytest.mark.asyncio
async def test_inspect_schema_tool_exists():
    """Verify inspect_schema is registered as an MCP tool."""
    tools = await mcp.list_tools()
    tool_names = [t.name for t in tools]
    assert "inspect_schema" in tool_names

@pytest.mark.asyncio
async def test_inspect_schema_has_correct_params():
    """Verify the tool has required parameters."""
    tools = await mcp.list_tools()
    schema_tool = next(t for t in tools if t.name == "inspect_schema")
    assert "connection_id" in schema_tool.inputSchema["properties"]

@pytest.mark.asyncio
async def test_detect_anomalies_sensitivity_enum():
    """Verify sensitivity parameter accepts valid values."""
    tools = await mcp.list_tools()
    anomaly_tool = next(t for t in tools if t.name == "detect_anomalies")
    params = anomaly_tool.inputSchema["properties"]
    assert "sensitivity" in params
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_full_analysis_pipeline():
    """End-to-end test of the full_analysis MCP tool."""
    from mcp import ClientSession
    from mcp.client.stdio import stdio_client

    async with stdio_client("python", ["-m", "app.mcp_server"]) as transport:
        async with ClientSession(*transport) as session:
            await session.initialize()

            # List available tools
            tools = await session.list_tools()
            assert len(tools.tools) >= 7

            # Call inspect_schema
            result = await session.call_tool("inspect_schema", {
                "connection_id": "test-db"
            })
            assert "tables" in result.content[0].text
```

### Manual Testing with MCP Inspector

```bash
# Install the MCP Inspector (official debugging tool)
npx @modelcontextprotocol/inspector python -m app.mcp_server
```

This opens a web UI where you can:
- See all registered tools, resources, and prompts
- Call tools with custom parameters
- Inspect responses
- Debug transport issues

---

## 12. Deployment

### Local Development (stdio)

```bash
cd backend
python -m app.mcp_server
# Server runs on stdio — connect from Claude Desktop
```

### Production (SSE alongside FastAPI)

```bash
# Your existing FastAPI app serves both REST API and MCP
uvicorn app.main:app --host 0.0.0.0 --port 8000
# MCP SSE available at: http://localhost:8000/mcp/sse
# MCP messages at: http://localhost:8000/mcp/messages/
```

### Docker

```dockerfile
# Add to existing Dockerfile
RUN pip install mcp>=1.0.0

# Expose MCP SSE port (if running standalone)
EXPOSE 8001

# Or just run as part of existing FastAPI (port 8000)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables

```env
# .env additions for MCP
MCP_API_KEYS=key1,key2                    # Comma-separated valid API keys
MCP_ALLOWED_CONNECTIONS=readonly-prod,dev  # Which DB connections MCP can access
MCP_RATE_LIMIT=60/minute                  # Rate limit for MCP tool calls
```

---

## 13. Real-World Usage Scenarios

### Scenario 1: Data Analyst in Claude Desktop

```
User: "Are there any anomalies in our orders data?"

Claude sees available MCP tools → selects inspect_schema
→ discovers "orders" table with 50K rows, 12 columns

Claude calls sample_data(table="orders", limit=2000)
→ gets 2000 rows, 8 numeric columns, 4 categorical

Claude calls detect_anomalies(sensitivity="medium")
→ finds 15 anomalies: 3 critical (revenue spikes), 12 warnings

Claude explains in plain English:
"I found 3 critical anomalies in your orders data.
 Order #4521 has a revenue value 4.2 standard deviations above the mean..."
```

### Scenario 2: Developer in Cursor IDE

```
Developer: "What does the production schema look like?"

Cursor calls inspect_schema(connection_id="prod-readonly")
→ returns 24 tables, 156 relationships, entity types detected

Developer sees structured JSON in their IDE sidebar with:
- Table list with row counts
- Entity type classification
- Relationship graph
```

### Scenario 3: Automated Monitoring Pipeline

```python
# External monitoring script using MCP client
from mcp import ClientSession

async def daily_anomaly_check():
    async with connect_to_mcp("http://your-server:8000/mcp/sse") as session:
        # Run full analysis
        result = await session.call_tool("full_analysis", {
            "connection_id": "production",
            "query": "Check for anomalies and data quality issues"
        })

        report = json.loads(result.content[0].text)
        if report.get("report", {}).get("key_findings"):
            send_slack_alert(report)
```

### Scenario 4: Multi-Agent Collaboration

```
Agent A (Data Quality Agent):
  → Calls inspect_schema + detect_anomalies via MCP
  → Finds 3 critical anomalies

Agent B (Notification Agent):
  → Receives anomaly data from Agent A
  → Calls Slack MCP server to alert #data-quality channel
  → Calls GitHub MCP server to create issue

Agent C (Report Agent):
  → Calls write_insight via MCP
  → Calls Google Drive MCP to archive the report
```

---

## 14. Comparison: Before vs After MCP

### Before MCP

```
                    ┌──────────┐
                    │ Frontend │ (only client)
                    └────┬─────┘
                         │ WebSocket / REST
                    ┌────▼─────┐
                    │ FastAPI  │
                    ├──────────┤
                    │  Planner │
                    │ Executor │
                    │ Tools(7) │
                    │ Memory   │
                    └──────────┘

- Only our frontend can use the tools
- Custom protocol (WebSocket events)
- No external AI can access our capabilities
- No composability with other tools
```

### After MCP

```
  Claude     Cursor     VS Code    Custom     Our
  Desktop    IDE        Copilot    Scripts    Frontend
    │          │          │          │          │
    └──────────┴──────┬───┴──────────┘          │
                      │ MCP Protocol             │ WebSocket
               ┌──────▼──────┐                   │
               │  MCP Server │                   │
               │  (thin wrap)│                   │
               └──────┬──────┘                   │
                      │                          │
               ┌──────▼──────────────────────────▼──┐
               │            FastAPI                  │
               ├─────────────────────────────────────┤
               │  Planner │ Executor │ Tools │ Memory│
               └──────┬─────────────────────────────┘
                      │
            External MCP Servers
            (Slack, GitHub, Drive, ...)

- Any MCP client can use our tools
- Standard protocol (JSON-RPC over stdio/SSE/HTTP)
- Full composability with MCP ecosystem
- Our agent can also consume external tools
```

---

## 15. Implementation Roadmap

### Phase 1: MCP Server — Core Tools (1-2 days)

- [ ] Add `mcp>=1.0.0` to requirements.txt
- [ ] Create `backend/app/mcp_server.py` with all 7 tools + `full_analysis`
- [ ] Create `backend/app/mcp/__init__.py` module structure
- [ ] Create Claude Desktop config example (`mcp_config.json`)
- [ ] Test with MCP Inspector (`npx @modelcontextprotocol/inspector`)
- [ ] Test with Claude Desktop

### Phase 2: Resources & Prompts (1 day)

- [ ] Add schema resource (`schema://{connection_id}/tables`)
- [ ] Add session memory resource (read-only access to agent memory)
- [ ] Add prompt templates (churn_analysis, anomaly_scan, forecast, segment)
- [ ] Write unit tests for tool registration and parameter validation

### Phase 3: SSE Transport + Auth (1 day)

- [ ] Mount SSE transport on existing FastAPI app
- [ ] Add API key authentication for remote MCP access
- [ ] Add connection-level access control
- [ ] Add rate limiting
- [ ] Integration tests with MCP client

### Phase 4: MCP Client (2-3 days)

- [ ] Create `MCPClientManager` for consuming external servers
- [ ] Create `MCPBridgeTool` adapter for TOOL_REGISTRY
- [ ] Integrate Slack MCP server for anomaly alerts
- [ ] Integrate filesystem MCP server for report exports
- [ ] Update AgentPlanner to include external MCP tools in plans

### Phase 5: Production Hardening (1-2 days)

- [ ] Docker configuration
- [ ] Environment variable documentation
- [ ] Monitoring and logging for MCP calls
- [ ] Error handling for disconnected clients
- [ ] Load testing with concurrent MCP sessions

---

## Quick Reference

### Commands

```bash
# Install
pip install mcp>=1.0.0

# Run standalone (stdio for Claude Desktop)
cd backend && python -m app.mcp_server

# Test with MCP Inspector
npx @modelcontextprotocol/inspector python -m app.mcp_server

# Run as part of FastAPI (SSE)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Key Files

| File | Purpose |
|------|---------|
| `backend/app/mcp_server.py` | MCP server entry point with all tool definitions |
| `backend/app/mcp/auth.py` | Authentication for remote MCP access |
| `backend/app/mcp/client.py` | MCP client for consuming external servers |
| `backend/mcp_config.json` | Claude Desktop configuration example |
| `backend/app/services/apex_agent/tools/__init__.py` | Existing TOOL_REGISTRY (unchanged) |

### Links

- [MCP Specification](https://spec.modelcontextprotocol.io)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [MCP Server Examples](https://github.com/modelcontextprotocol/servers)
- [Claude Desktop MCP Setup](https://modelcontextprotocol.io/quickstart/user)
