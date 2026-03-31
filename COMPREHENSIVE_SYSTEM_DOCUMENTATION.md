# Living Data Intelligence Platform
## Comprehensive Architectural & Functional Documentation

| Attribute | Value |
| :--- | :--- |
| **Version** | 1.0 |
| **Classification** | Technical Reference |
| **Date** | March 2026 |

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Data Strategy & Supported Integrations](#3-data-strategy--supported-integrations)
4. [Intelligence & Neural Core Layer](#4-intelligence--neural-core-layer)
5. [Mathematical & Geometric Engines](#5-mathematical--geometric-engines)
6. [Health, Monitoring & Anomaly Detection](#6-health-monitoring--anomaly-detection)
7. [User Interface & Interactive Workflows](#7-user-interface--interactive-workflows)
8. [Future Trajectory](#8-future-trajectory)

---

## 1. Executive Summary
The **Living Data Intelligence Platform** represents a paradigm shift in database visualization and monitoring — transforming static relational and non-relational data stores into dynamic, three-dimensional organisms that breathe, pulse, and respond in real time to the data flowing through them.

At its core, the platform addresses a fundamental challenge in modern data engineering: the cognitive gap between raw database metrics and actionable intelligence. Traditional monitoring dashboards present tables, charts, and logs that require significant mental effort to synthesize. This platform instead leverages spatial computing, statistical physics, and neural-inspired state management to create an intuitive, immersive experience where anomalies literally glow red, stressed systems pulse faster, and the health of your entire data ecosystem is perceivable at a glance.

The architecture is fully decoupled — backend intelligence services communicate with a high-performance WebGL frontend over WebSockets, enabling sub-second metric propagation and smooth 60fps rendering regardless of database complexity.

### 1.1 Value Proposition
| Capability | Benefit |
| :--- | :--- |
| **Real-time 3D visualization** | Instant situational awareness across complex schemas. |
| **AI-powered classification** | Automatic distinction between transactional facts and reference dimensions. |
| **Predictive anomaly detection** | Statistical alerts with natural language explanations before incidents escalate. |
| **Natural language interaction** | Query your schema conversationally; highlighted results appear directly in the graph. |
| **Sonic intelligence mapping** | Auditory monitoring enables eyes-free awareness of system state. |

---

## 2. System Architecture
The platform follows a decoupled full-stack architecture optimized for real-time data streaming and GPU-accelerated visualization. This separation ensures that compute-intensive analytical workloads never block the rendering pipeline, while also enabling independent scaling of backend intelligence services.

### 2.1 High-Level Architecture Diagram
The system operates as a **tri-axial engine**:
1.  **Ingestion Axis**: `DatabaseConnector` → `SchemaAnalyzer` → `NeuralCore`.
2.  **Intelligence Axis**: `AnomalyDetector` → `GraphIntelligence` → `AgentService`.
3.  **Visualization Axis**: `WebSocket` → `Zustand/Context Store` → `ThreeGraph (WebGL)`.

### 2.2 Backend: FastAPI Intelligence Services
The backend is built on FastAPI running under Uvicorn, leveraging Python's scientific computing ecosystem for analytical workloads.

#### Technology Stack
- **Runtime**: Python 3.10+ with async/await concurrency.
- **Framework**: FastAPI for REST endpoints and WebSocket handlers.
- **Data Processing**: Pandas, NumPy for vectorized operations.
- **Machine Learning**: Scikit-Learn for PCA, K-Means clustering.
- **Graph Analysis**: NetworkX for community detection and centrality metrics.

#### Core Service Responsibilities
| Service | Function |
| :--- | :--- |
| **SchemaAnalyzer** | Bulk metadata extraction from database information schemas. |
| **AIClassifier** | Heuristic and ML-based table categorization (Facts vs. Dimensions). |
| **NeuralCore** | Central state machine simulating GNN-like learning progression. |
| **GravityEngine** | PCA-based dimensionality reduction for spatial coordinate computation. |
| **RealtimeMonitor** | Sub-second metric aggregation and WebSocket broadcast. |
| **AnomalyDetector** | Z-Score and IQR statistical monitoring against historical baselines. |

### 2.3 Frontend: React + Three.js Render Loop
The visualization layer is engineered for performance and immersion, combining React's declarative component model with Three.js's low-level WebGL capabilities.

#### Technology Stack
- **Framework**: React 19 with concurrent rendering features.
- **Styling**: TailwindCSS v4 for utility-first responsive design.
- **Animation**: Framer Motion for UI transitions and micro-interactions.
- **3D Engine**: Three.js via React-Three-Fiber (R3F) declarative bindings.
- **Utilities**: React-Three-Drei for common 3D patterns (cameras, controls, effects).

#### Render Loop Architecture
The R3F `useFrame` hook drives the animation loop at 60fps, mapping incoming signal data to visual properties:
1.  **Read** latest metrics from state context (vitality, pulse rate).
2.  **Compute** node transformations (scale, rotation, color).
3.  **Update** particle systems (velocity, spawn rate based on TPS).
4.  **Apply** sine-wave breathing animation ($A \times \sin(\omega t)$).
5.  **Trigger** GPU draw calls via `InstancedMesh`.

### 2.4 WebSocket Data Pipeline
Real-time communication occurs over persistent WebSocket connections (`/api/ws`).

#### Pipeline Characteristics
- **Protocol**: WebSocket (RFC 6455) over TCP.
- **Serialization**: JSON for structured metric payloads.
- **Latency Target**: Sub-second burst delivery (< 200ms typical).
- **Reconnection**: Automatic exponential backoff with state reconciliation.

---

## 3. Data Strategy & Supported Integrations
The platform adopts a read-only, non-invasive approach to database connectivity.

### 3.1 Supported Database Systems
| Database | Connector | Metadata Source | Notes |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | `asyncpg` | `information_schema`, `pg_catalog` | Full support including foreign key introspection. |
| **MySQL** | `aiomysql` | `information_schema` | InnoDB and MyISAM engine support. |
| **MongoDB** | `motor` | Collection sampling, `$collStats` | Schema inferred from document sampling. |

### 3.2 Read-Only Connection Policy
All connections are established with minimal privilege:
```sql
GRANT SELECT ON information_schema.* TO 'livingdata_ro';
GRANT SELECT ON target_schema.* TO 'livingdata_ro';
```
The platform explicitly:
- Never executes `INSERT`, `UPDATE`, `DELETE`, or `DDL`.
- Never creates temporary tables or indexes.
- Only reads metadata schemas and samples aggregate metrics.

### 3.3 Connection Pooling
- **Pool Size**: Configurable (default: 5 connections per data source).
- **Idle Timeout**: 30 seconds.
- **Health Checks**: Periodic validation queries to detect stale connections.

---

## 4. Intelligence & Neural Core Layer

### 4.1 SchemaAnalyzer
Performs bulk metadata extraction by querying database information schemas directly.

#### Extracted Metadata
- Table names, schemas, and storage engines.
- Column definitions (types, nullability, defaults).
- PK/FK mappings and row counts.

#### Introspection Query Pattern (PostgreSQL)
```sql
SELECT tc.table_name, kcu.column_name, ccu.table_name AS target_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

### 4.2 AIClassifier
Categorizes each table as either a **Fact** (transactional) or **Dimension** (reference) entity.

#### Classification Heuristics
- **Fact**: High row count, many outbound FKs, timestamp/amount columns (`fact_`, `transactions_`).
- **Dimension**: Low row count, few FKs, descriptive names (`dim_`, `users_`, `products_`).

### 4.3 NeuralCore State Management
The `NeuralCore` maintains the global "Learning State" of the data ecosystem.

#### State Lifecycle
1.  **Initializing**: Metadata loading, slowly rotating 3D graph.
2.  **Learning**: Computing embeddings, accelerating pulse.
3.  **Optimized**: Stable breathing rhythm, real-time monitoring enabled.
4.  **Degraded**: Amber warning overlay, frozen positions, awaiting reconnection.

---

## 5. Mathematical & Geometric Engines

### 5.1 PCA & K-Means Gravity Engine
The Gravity Engine computes 3D coordinates for individual records (Tier 3 View).

#### Pipeline
1.  **Feature Extraction**: Vectorization of table rows.
2.  **Normalization**: Z-score standardization.
3.  **PCA Reduction**: Projecting high-dimensional data into 3 components ($X, Y, Z$).
4.  **K-Means Clustering**: Grouping records into semantic "cities."

#### Mathematical Formulation
$$Z = X_{norm} \times W \quad \text{where } W \in \mathbb{R}^{d \times 3}$$

### 5.2 NetworkX / Heuristic Clustering
For macro-level (table) organization.

- **Heuristic**: Groups by prefix (e.g., `sales_` vs `auth_`).
- **NetworkX**: Applies **Louvain Modularity** algorithms to find community structures based on foreign keys.

### 5.3 Fibonacci Sphere Algorithm
Used in `ThreeGraph.jsx` to distribute cluster centroids equidistantly.
$$\theta_i = 2\pi \times (i / \phi)$$
$$y_i = 1 - (2i / (n-1))$$
This avoids clumping and ensures a balanced 3D distribution.

---

## 6. Health, Monitoring & Anomaly Detection

### 6.1 Real-Time Metrics Streaming
The `RealtimeMonitor` broadcasts 500ms bursts via WebSockets.

#### WebSocket Payload Structure
```json
{
  "timestamp": "2026-03-20T09:28:00Z",
  "metrics": { "tps": 1250, "health_score": 94, "latency_p99": 87 },
  "anomalies": []
}
```

### 6.2 Health Scoring Engine
$$Health = 100 - (w_1 \times Load + w_2 \times Anomalies + w_3 \times Errors)$$
- **Score 80-100**: Green glow, 60 BPM.
- **Score 50-79**: Yellow glow, 120 BPM.
- **Score 0-49**: Red strobe, 180 BPM.

### 6.3 Z-Score Anomaly Detection
$$z = (x - \mu) / \sigma$$
Flags as anomaly if $|z| > 3.0$.

### 6.4 Explainable AI Alerts
Generates natural language context: *"Transaction rate is 45% higher than the normal baseline... likely correlated with marketing campaign."*

---

## 7. User Interface & Interactive Workflows

### 7.1 3D Graph Interaction
- **Size**: Mapped to Row Count (Log Scale).
- **Color**: Mapped to Cluster Membership.
- **Pulse**: Mapped to current Transaction Rate.

### 7.2 Latent World Explorer (Orbital View)
Transitions to a "Solar System" view where columns are satellites.
- **PK**: Gold (Innermost orbit).
- **FK**: Blue (Medium orbit).
- **Numeric**: Green (Variable velocity).

### 7.3 Hierarchical Circle Packing Drill-Down
A 2D recursive layout for deep table localized relationships.

### 7.4 Historical Flow Timeline
24-hour playback for seeing how relationships evolved.

### 7.5 Chat Interface
Natural language queries like *"Show the most active tables"* are highlighted in 3D.

### 7.6 Sonic Intelligence (Audio Mapping)
- **Gravity**: Oscillator Frequency.
- **Entropy**: LFO Rate (Wobble).

---

## 8. Future Trajectory
- **Snowflake & BigQuery** integrations.
- **VR/AR (WebXR)** immersion.
- **Collaborative Workspaces** for multi-user analysis.
