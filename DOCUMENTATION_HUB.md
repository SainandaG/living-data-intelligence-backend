# 🧠 Living Data Intelligence Platform - Functional Manual

**The Digital Nervous System: A Deep Dive into Implementation & Mechanics**

This document serves as the definitive technical reference for the current implementation of the Living Data Intelligence Platform. It details the internal logic, mathematical engines, and architectural flows that power the "Living Data" experience.

---

## 📚 Table of Contents
1. [🔭 System Architecture](#1-system-architecture)
2. [📘 Developer Onboarding](#2-developer-onboarding)
3. [🏗️ Backend Intelligence Layer](#3-backend-intelligence-layer)
4. [📐 Geometry & Mathematics](#4-geometry--mathematics)
5. [⚡ Anomaly & Health Engines](#5-anomaly--health-engines)
6. [🎨 Frontend 3D Logic & State](#6-frontend-3d-logic--state)
7. [📊 Hierarchical Flow & Dynamics](#7-hierarchical-flow--dynamics)
8. [🔌 API & Data Contracts](#8-api--data-contracts)
9. [✨ Visual Language Decoder](#9-visual-language-decoder)
10. [📁 Source Directory Audit](#10-source-directory-audit)

---

## 1. System Architecture

The platform is a decoupled full-stack application designed around a **Reactive Biomorphic Data Model**. Unlike standard monitoring tools, it transforms relational and non-relational data into a 3D gravitational network.

### High-Level Flow
1. **Introspection**: `SchemaAnalyzer` performs bulk metadata extraction via optimized system queries.
2. **Classification**: `AIClassifier` tags entities (fact/dimension/neural) using deep heuristics.
3. **Simulation**: `NeuralCore` maintains a persistent "Learning State" for the graph, tracking accuracy.
4. **Calculated Physics**: `GravityEngine` computes statistical 3D coordinates using PCA and K-Means.
5. **Real-time Streaming**: `RealtimeMonitor` pushes metric bursts via WebSockets into the Redux-like state.
6. **Rendering**: `ThreeGraph` maps these signals to visual pulses, rotations, and synchronous animations.

---

## 2. Developer Onboarding

### Technical Stack
- **Backend API**: FastAPI (Python 3.10+)
- **Analysis Engine**: Pandas, NumPy, Scikit-Learn (PCA & K-Means)
- **3D Render Loop**: Three.js, React-Three-Fiber, React-Three-Drei
- **UI Architecture**: React 19, TailwindCSS v4, Framer Motion

### Dependency Environment
```bash
# Backend Implementation
cd app
python -m venv venv
# Enable environment (Windows: .\venv\Scripts\activate | Mac: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env

# Frontend Implementation
cd frontend
npm install
```

### Execution Protocol
Terminal 1 (Backend): `python main.py` (Default: localhost:8001)  
Terminal 2 (Frontend): `npm run dev` (Default: localhost:5173)

---

## 3. Backend Intelligence Layer

### `NeuralCore.py`: The Simulation Brain
The `NeuralCore` provides the "organic intelligence" state of the system.
- **Model Simulation**: It simulates the behavior of a GNN (Graph Neural Network) by maintaining internal weights.
- **Learning Loop**: The `process_signal()` method mimics a training pass. It updates a simulated `accuracy` and `current_loss` metric based on the intensity of incoming data signals.
- **State Management**:
    - `model_state`: "Initializing", "Learning", or "Optimized".
    - `gravity_store`: Persistent weights assigned to specific node UUIDs.
    - `agent_status`: Derived from transaction frequency and error rates.

### `SchemaAnalyzer.py`: Bulk Intelligence
Optimized for performance on large-scale databases.
- **SQL Optimization**: Uses bulk queries into `information_schema` (Postgres/MySQL) to retrieve table structures, primary keys, and foreign keys in $O(1)$ query complexity.
- **AI Classification**: Integrates with `ai_classifier.py` to determine if a table is a "Fact" (transactional) or "Dimension" (descriptive) using pattern matching and semantic analysis.
- **Caching**: Implements a local TTL-based cache to prevent redundant heavy schema scans.

---

## 4. Geometry & Mathematics

### Principal Component Analysis (PCA)
Used within `GravityEngine.py` to position row-level records in 3D space.
1. **Normalization**: Rows are converted to numeric vectors using standard scaling.
2. **Dimension Reduction**: PCA finds the three eigenvectors with the highest eigenvalues.
3. **Projection**: Data is projected onto these three vectors, becoming $X, Y, Z$ coordinates.
4. **Result**: Similar records naturally cluster together in the 3D space.

### Fibonacci Sphere Algorithm
Used in `ThreeGraph.jsx` for the macro-level entity layout.
- **Goal**: Place $N$ nodes equidistant on a spherical surface.
- **The Golden Ratio**: Uses $\Phi = (1 + \sqrt{5}) / 2$.
- **Calculation**: 
    - $y = 1 - (i / (N - 1)) \times 2$
    - $radius = \sqrt{1 - y^2}$
    - $\theta = golden\_angle \times i$
    - $x = \cos(\theta) \times radius$
    - $z = \sin(\theta) \times radius$

---

## 5. Anomaly & Health Engines

### `GraphIntelligence.py`: The Health Score Logic
The system maintains a real-time `health_score` (0-100) calculated per graph request:
- **Deduction Matrix**:
    - **High Load**: >1200 TX/min = -20 pts.
    - **Fraud Spike**: >5 alerts in window = -30 pts.
    - **Error Rate**: >25 failed TX = -25 pts.
- **Visual Mapping**:
    - **Healthy (80-100)**: Green glow, 60bpm pulse.
    - **Stressed (50-79)**: Yellow glow, 120bpm pulse.
    - **Anomalous (0-49)**: Red strobe, 180bpm pulse.

### `AnomalyDetector.py`: Statistical Detection
Implements **Z-Score Detection** to find spikes in metrics.
- **Formula**: $z = (x - \mu) / \sigma$
- **Detection**: If $z > 3.0$, an anomaly event is emitted via WebSockets.
- **Explanations**: Maps deviations to human-readable strings based on the metric type (e.g., "Transaction volume is 3x higher than 24h average").

---

## 6. Frontend 3D Logic & State

### The Render Loop
Driven by `@react-three/fiber`'s `useFrame` hook.
- **Breathing Animation**: Nodes use a $\sin(time \times scale)$ function to simulate breathing.
- **Rotation**: The entire group rotates on the Y-axis, speed-influenced by the central `vitality` metric.
- **Optimization**: Uses `InstancedMesh` for particles to handle 1000+ moving elements at 60FPS.

### Window Management & Context
- **`WindowManagerProvider`**: A custom React Context that manages an array of active windows.
- **Toggle Logic**: Each UI window (Neural Core, Metrics, DB Connect) has a unique ID and `zIndex` state.
- **Persistence**: Window positions and minimize states are preserved during the session.

---

## 7. Hierarchical Flow & Dynamics

### Circle Packing Layout
Implemented for table drill-downs to show internal structure.
- **Central Node**: The Table itself.
- **Primary Ring**: Direct child columns.
- **Secondary Ring**: Related Foreign Key tables.
- **Dynamic Sizing**: Circles scale based on the data volume of the specific column (unique count).

### Historical Timeline Playback
- **Data Buffer**: Backend stores a rolling 24-hour log of metrics.
- **Client Interpolation**: Moving the slider interpolates between two data points to create smooth flow transitions.
- **Particle Velocity**: The speed of particles along the Bezier curves is calculated as $V = throughput\_constant \times timestamp\_volume$.

---

## 8. API & Data Contracts

### 1. `GET /api/graph/{connection_id}`
**Request**: Standard GET  
**Response Structure**:
```json
{
  "nodes": [
    { "id": "users", "type": "dimension", "vitality": 0.8, "pos": [10, 5, -2] }
  ],
  "edges": [
    { "source": "orders", "target": "users", "strength": 0.9 }
  ],
  "metadata": { "health_score": 92, "neural_accuracy": 0.74 }
}
```

### 2. `POST /api/gravity/calculate`
**Payload**: `{"table": "transactions", "limit": 500}`  
**Function**: Triggers the PCA engine for row-level 3D clustering.

### 3. `POST /api/ai/chat`
**Payload**: `{"query": "Show me the most active tables"}`  
**Logic**: Uses the `AgentService` to analyze schema metadata and return a natural language insight plus node IDs for the frontend to highlight.

---

## 9. Visual Language Decoder

### Color Protocols
| Category | Color | Implementation Meaning |
| :--- | :--- | :--- |
| **Logic Entity** | 🔵 Cyan | Dimension / Reference Master Data |
| **Event Entity** | 🟡 Gold | Fact / Transactional Data |
| **Intelligence** | ⚛️ Magenta | Neural Core / AI Determined Priority |
| **System Error** | 🔴 Red | Critical Failure or Fraud Anomaly |

### Animation Meanings
- **Slow Pulse (1s period)**: Healthy system state.
- **Rapid Pulse (0.3s period)**: High resource utilization / Stress.
- **Expanding Ring**: New data signal received.
- **Converging Particles**: AI Relationship prediction in progress.

---

## 10. Source Directory Audit

### Backend (/app)
- **`/api`**: Route definitions (Pydantic models, FastAPI routers).
- **`/services`**: Core logic (Math, DB drivers, AI agents).
- **`/models`**: Shared data schemas and SQLAlchemy types.
- **`/core`**: Configuration and global dependency management.

### Frontend (/src)
- **`/components/Three`**: All Three.js specialized canvas objects.
- **`/components/Dashboard`**: Standard React 2D UI elements.
- **`/context`**: Global states (Window Manager, Auth, Database).
- **`/hooks`**: Custom Three.js and API lifecycle hooks.

---
**Document Status**: COMPLETED (Implementation Phase 1)  
**Version**: 1.1.0  
**Authored by**: Intelligence Engineering Team
