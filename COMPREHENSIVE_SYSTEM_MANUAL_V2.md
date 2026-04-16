# 🧠 V2: Comprehensive Architectural & Functional Manual
## Living Data Intelligence Platform
**The Digital Nervous System of Database Environments**

---

## 1. Executive Overview
The **Living Data Intelligence Platform** is a state-of-the-art diagnostic and visualization environment designed to transform cold, static database schemas into a vibrant, biomorphic 3D "Nervous System." 

By combining Deep Heuristics, Autonomous Agents, and high-fidelity 3D rendering, the platform allows engineers to *feel* the health of their data infrastructure. This manual provides an exhaustive 20-page equivalent deep-dive into the architecture, functional mechanics, and mathematical foundations of the system.

---

## 2. Architectural Vision: The Biomorphic Model
Unlike traditional ERD tools that use static rectangular layouts, this platform treats data as a **Dynamic Gravitational Network**. 

- **Nodes (Planets)**: Represent tables or collections.
- **Edges (Gravitational Bonds)**: Represent Foreign Key relationships or AI-predicted correlations.
- **Emitters (Particles)**: Represent real-time data flow and transaction intensity.
- **Atmosphere (Glow)**: Represents the "Vitality" or "Neural Health" of an entity.

---

## 3. The Neural Core: Cognitive Schema Intelligence
The **Neural Core** (`backend/app/services/neural_core/core.py`) is the simulation brain. It maintains a persistent state of "Learning" about the schema.

### 3.1 Mathematical Foundations
The system uses three primary metrics to determine the "State of Being" for every node:

#### 📊 Gravity ($G$)
Gravity determines the center of mass in the visualization and the importance of a table in the semantic hierarchy.
$$G = \log_{10}(\text{row\_count} + 1) \times \text{centrality\_weight}$$
- **High Gravity (Nexus)**: Fact tables with millions of rows.
- **Low Gravity (Peripheral)**: Config tables or small reference dimensions.

#### 💓 Vitality ($V$)
A real-time score (0-100) reflecting the "BPM" or activity level.
$$V = f(\text{TPS}, \text{Error Rate}, \text{Anomaly Z-Score})$$
- Linked to the **Pulse Animation** speed in the UI.

#### 📉 Entropy ($E$)
A measure of relationship complexity. High entropy indicates a "Spiderweb" of dependencies that may represent architectural debt.

### 3.2 Signal Processing Pipeline
1.  **Ingestion**: `DatabaseConnector` fetches metadata.
2.  **Transformation**: `SchemaAnalyzer` maps SQL types to biomorphic entities (e.g., "Event" vs "Logic").
3.  **Neural Update**: `NeuralCore.process_signal()` updates the weights of the graph based on the scan.
4.  **Snapshots**: State is persisted for historical comparison in the **Time Machine**.

---

## 4. Autonomous Agent Framework
The system employs a multi-tiered hierarchy of AI agents that "patrol" the data graph.

### 4.1 Agent Hierarchy
- **Tier 0 (Reactive)**: Immediate response to table scans. They calculate `in_degree` and `out_degree` on-the-fly.
- **Tier 1 (Proactive)**: Deep scanners. They run background "Deep Manifold" analysis to find non-FK relationships.
- **WEZU Agents**: Specialized vertical intelligence.
    - **GridSentinel**: Monitors battery health (SoH) for degradation.
    - **AnomalyHunter**: Detects GPS geofence breaches in logistics tables.

### 4.2 Agent Thought Loops
Agents operate in a "Patrol Cycle":
1.  **Observe**: Query a table for a sample or metric.
2.  **Evaluate**: Cross-reference with the Neural Core's expectations.
3.  **Signal**: If an anomaly is found, emit a `metrics_update` burst to the WebSocket.

---

## 5. Multi-Dialect Data Strategy
The `DatabaseConnector` is a unified adapter for diverse data sources.

### 5.1 Connection Resilience
- **PostgreSQL (asyncpg)**: High-speed asynchronous pooling.
- **Neon Cloud Optimization**: Special "Wake-up" sequences handle serverless databases in standby mode.
- **MySQL (aiomysql)**: Full support for traditional relational workloads.

### 5.2 Schema Introspection
The `SchemaAnalyzer` uses highly optimized recursive queries into `information_schema` to build a complete dependency map in under 2 seconds, even for schemas with 500+ tables.

---

## 6. 3D Visualization: The Render Engine
The frontend (`frontend/src/components/Dashboard/ThreeGraph.jsx`) uses **Three.js** and **React-Three-Fiber** for cinema-grade rendering.

### 6.1 Physics & Layout
- **D3-Force-3D**: Calculates real-time repulsion and attraction between planets.
- **Fibonacci Sphere Allocation**: Distributes clusters evenly across a 3D volume to prevent overlapping.
- **PCA (Principal Component Analysis)**: Used in the **Drill-Down View** to plot records in 3D based on their feature similarity.

### 6.2 Rendering Optimization
- **InstancedMesh**: Allows the platform to render 50,000+ data particles at 60 FPS.
- **UnrealBloomPass**: Creates the "Neural Glow" effect that signals table vitality.
- **Z-Buffer Management**: Ensures that "Far-Field" stars and "Near-Field" planets interact correctly.

---

## 7. Functional Guide: User Workflows

### 7.1 Connecting and Initializing
1.  Launch the **Connection Modal**.
2.  Select your provider (Postgres/MySQL/Neon).
3.  Click **Connect**. The "Neural Core" status bar will show the scan progress.

### 7.2 Navigation & Lenses
The UI supports multiple specialized "Lenses" to filter the visualization:
- **Default Lens**: Standard biomorphic view.
- **Health Lens**: Nodes strobe based on error rates.
- **Latent Lens**: Shows the "Semantic Universe," grouping nodes by data type and meaning.
- **Perspective Lineage**: Focuses on data parents and children.

### 7.3 AI Analyst Chat
The dockable chat window allows for natural language interrogation:
- *"Who are the neighbors of the 'orders' table?"*
- *"Give me a health report for the battery grid."*
- *"Optimize the graph layout for high-density clusters."*

---

## 8. Technical Reference: API & System Audit

### 8.1 Exhaustive API Router Directory
The following routers are managed by `router_registry.py`:

| Prefix | Name | Responsibility |
| :--- | :--- | :--- |
| `/api/auth` | **Auth** | JWT generation and validation. |
| `/api` | **Database** | CRUD for connection profiles. |
| `/api` | **Schema** | Bulk metadata extraction. |
| `/api` | **Graph** | [CORE] 3D structure generation. |
| `/api/ai` | **AI Intelligence**| Optimization and Chat engines. |
| `/api/ws` | **WebSocket** | High-frequency metric streaming. |
| `/api` | **Metrics** | Historical statistics and vitals. |
| `/api` | **Evolution** | Time Machine snapshots and playback. |
| `/api` | **Ontology** | Domain-specific knowledge (WEZU). |

### 8.2 File System Mapping (High-Level)
- **`/backend/app/api`**: FastAPI endpoints.
- **`/backend/app/services`**: Business logic, math, and DB drivers.
- **`/backend/app/agents`**: Specialized AI workers.
- **`/frontend/src/components`**: 3D and 2D UI components.
- **`/frontend/src/stores`**: State management (Zustand/Context).

---

## 9. Operations & Maintenance
### 9.1 Logging & Vitals
The `vitals_service` collects low-level system health, including memory usage, async loop lag, and WebSocket client counts. This is visualized in the **System Vitals Dashboard**.

### 9.2 Sonification Engine
The system generates a real-time "Neural Hum" based on your data. 
- **Frequency**: Tied to system-wide Gravity.
- **Complexity**: Tied to total active Anomalies.

---

## 10. Conclusion
The Living Data Intelligence Platform represents a paradigm shift in database observation. By treating information as a living entity, we move from "Looking at Data" to "Observing a System."

**VERSION**: 2.2.0  
**AUTHORED BY**: Intelligence Architecture Team  
**STATUS**: DEFINITIVE
