# 🧠 Technical Architecture: Living Data Intelligence

This document details the high-fidelity engineering principles, mathematical models, and data synchronization protocols that power the platform.

---

## 1. The Neural Core (Cognitive Schema Intelligence)
The **Neural Core** (`backend/app/services/neural_core/core.py`) is the central intelligence hub. It treats the database schema not as a static structure, but as a living organism that emits signals.

### Core Metrics & Formulas
- **Gravity ($G$)**: Represents the "Importance" of a node.
  - Formula: $G = \log_{10}(\text{row\_count} + 1) \times \text{centrality\_weight}$
  - High-gravity nodes attract "Emitters" and influence the spatial layout.
- **Vitality ($V$)**: Represents the real-time health and activity level of a table.
  - Logic: Influenced by recent transaction rates and anomaly detections. Node "pulses" in the UI are tied directly to this value.
- **Entropy ($E$)**: Measure of schema complexity and relationship fragmentation.

### Ontology Layer
The system uses specialized ontologies (e.g., **WEZU Energy**) to provide domain-aware intelligence. This allows agents to understand that a table named `telemetics_data` refers to battery sensor logs, enabling specialized checks like "GPS Geofence Breach".

---

## 2. 3D Manifold Visualization (Three.js Engine)
The visualization layer (`frontend/src/components/Dashboard/ThreeGraph.jsx`) uses a multi-layered approach to represent data.

### Visualization Lenses
1.  **Galaxy View (Force-Direct Layout)**:
    - Uses `d3-force-3d` for physics simulation.
    - Nodes are positioned based on their relationships ($FK$) and $G$.
2.  **Latent Space (Semantic Clustering)**:
    - Tables are projected into a 3D manifold based on semantic similarity of column names and data types.
    - **Clustering Methods**:
      - *Heuristic*: Prefix-based matching (e.g., `user_` prefix).
      - *NetworkX*: Graph-theory based community detection (Modularity).
3.  **Tier 3 (3D Voxel Tables)**:
    - When drilling down, records are rendered as 3D voxels within the table's "Gravity Well".

---

## 3. Real-Time Synchronization (WebSocket Protocol)
The backend streams high-frequency updates via WebSockets (`backend/app/api/websocket.py`).

### Data Burst Structure
Every 2 seconds, the `RealtimeMonitor` broadcasts a payload to all connected clients:
- **`metrics_update`**: TPS, total rows, and active battery counts (WEZU).
- **`evolved_nodes`**: Incremental changes to node size/status based on live traffic.
- **`anomalies`**: Justified anomaly detections detected by T1 agents.

---

## 4. Autonomous Agent Hierarchy
Agents operate in a tiered structure to balance responsiveness and depth:

| Tier | Name | Role | Responsibility |
| :--- | :--- | :--- | :--- |
| **T0** | **Reactive** | Signal Response | Responds to table scans or metadata changes immediately. |
| **T1** | **Proactive** | Pattern Mining | Runs background complex queries to find correlations and anomalies. |
| **WEZU** | **Domain-Specific**| Vertical Intelligence| Monitors battery degradation (SoH) and location-based security. |

---

## 5. Multi-Dialect Database Adapter
The `DatabaseConnector` manages heterogeneous data sources:
- **PostgreSQL**: Primary support with `asyncpg`. Specialized handling for **Neon** (serverless) to manage sleepy connections.
- **MySQL / MongoDB**: Secondary support with unified connection pooling.
- **SQL Injection Guard**: All identifiers are validated through `validate_identifier` to prevent malicious schema manipulation.
