# 🔍 File-by-File System Audit: Living Data Intelligence

This document provides a comprehensive mapping of every source file in the repository, categorized by its functional domain and responsibility.

---

## 🏗️ Backend Core (FastAPI)

### Root Directory (`/backend`)
- **`main.py`**: Application entry point. Handles lifespan (startup/shutdown), middleware (CORS, GZip), and coordinates background tasks.
- **`router_registry.py`**: Centralized routing hub. Dynamically registers all API modules and enforces security policies.
- **`health_endpoints.py`**: System diagnostics. Provides `/api/health`, `/api/vitals/`, and development-only debug traces.
- **`requirements.txt`**: Python dependencies (FastAPI, SQLAlchemy, Pandas, etc.).

### API Layer (`/backend/app/api`)
- **`auth.py`**: JWT-based authentication and user session management.
- **`database.py`**: Database connection lifecycle (Connect, List, Delete).
- **`schema.py`**: Schema introspection and metadata extraction.
- **`graph.py`**: **Primary Engine.** Generates the 3D graph structures, calculates initial positions, and enriches nodes with metrics.
- **`ai.py`**: AI Orchestration. Handles Chat, Gravity Suggestions, and Layout Optimization (Heuristic/NetworkX).
- **`websocket.py`**: Real-time bidirectional communication. Streams metrics, logs, and multiplayer presence.
- **`agent.py`**: Interface for autonomous T0/T1 agents and intent execution.
- **`metrics.py`**: Statistics aggregation and historical metric retrieval.
- **`drilldown.py`**: Visual drill-down logic for specific tables or columns.
- **`hierarchy.py`**: Calculates and streams hierarchical tree structures for data lineage.
- **`internal_node.py`**: Semantic clustering and internal manifold projection.
- **`latent_stream.py`**: High-frequency updates for the 3D Latent Space visualization.
- **`data_explorer.py`**: Sample data retrieval and ad-hoc query execution.
- **`data_flow.py`**: Logic for tracing data movement between entities.
- **`evolution.py`**: Timeline management and state playback for "Time Machine" features.
- **`ml_analysis.py`**: "Work on Data" endpoints for running ML models (Classification, Regression).
- **`vitals.py`**: Aggregates low-level system health and agent patrol logs.
- **`ontology.py`**: Domain-specific knowledge structures (e.g., WEZU Energy Ontology).
- **`node_xray.py`**: Detailed "X-Ray" analysis of individual data nodes.
- **`simulation.py`**: Controls for data simulation and scenario testing.
- **`seeder_api.py`**: Endpoints for populating demo data.

### Services Layer (`/backend/app/services`)
- **`db_connector.py`**: Asynchronous adapter for PostgreSQL, MySQL, and MongoDB. Includes retry logic for cloud-native DBs (Neon).
- **`neural_core/core.py`**: **The Brain.** Maintains the cognitive state of the schema, calculates gravity/vitality, and manages signal processing.
- **`graph_intelligence.py`**: Mathematical provider for node importance and system entropy.
- **`agent_service.py`**: Manager for the autonomous exploration loop and agent life-cycles.
- **`realtime_monitor.py`**: Aggregator for live metrics, anomalies, and health scores.
- **`chat_service.py`**: Integration with LLMs for natural language data analysis.
- **`living_graph_engine.py`**: Logic for evolving graph states over time based on activity.
- **`latent_space_service.py`**: Manifold projection (PCA/UMAP-like) for semantic clustering.
- **`vitals_service.py`**: System-level health monitoring and alert generation.
- **`connection_manager.py`**: Tracking of active sessions and client connections.
- **`cluster_store.py`**: Persistence and retrieval for layout clusters.

### Specialized Agents (`/backend/app/agents`)
- **`wezu_agents.py`**: Domain-specific intelligence for battery health (Sentinel) and geolocation (AnomalyHunter).
- **`agent_analyst.py`**: High-level reasoning agent for cross-table insights.
- **`t0_agent.py`**: Reactive "Tier 0" agents for immediate signal response.
- **`t1_agent.py`**: Proactive "Tier 1" agents for deep scanning and pattern mining.

### Visualization Logic (`/visualization`)
- **`glow_calculator.py`**: Computation of visual "glow" and "vitality" intensities for the UI.
- **`spatial_layout.py`**: Geometric algorithms for node positioning in 3D space.

---

## 🎨 Frontend Core (React + Three.js)

### Source Root (`/frontend/src`)
- **`main.jsx`**: React entry point with routing and global provider setup.
- **`App.jsx`**: The application shell. Manages the layout, navigation, and top-level Error Boundaries.
- **`index.css`**: Global design system tokens and Tailwind base layer.

### Components: Dashboard & Visualization (`/frontend/src/components/Dashboard`)
- **`ThreeGraph.jsx`**: **The Engine.** complex React-Three-Fiber component for 3D graph rendering, physics, and interaction.
- **`LatentSpaceLogic.jsx`**: Mathematics and UI logic for the Semantic Latent Manifold.
- **`DrillDownView.jsx`**: Detailed table inspection interface with record-level 3D visualization.
- **`DataFlowView.jsx`**: visualization of relationships and data movement.
- **`SchemaView.jsx`**: Traditional ERD-style visualization in a 3D context.
- **`AnalyticsView.jsx`**: Real-time statistics, anomaly lists, and gravity optimization charts.
- **`ChatInterface.jsx`**: Dockable AI analyst chat window.
- **`PerspectiveLineageView.jsx`**: Advanced lineage tracing by domain or category.
- **`SystemVitalsDashboard.jsx`**: Hardware-style monitoring of backend health.
- **`GenerationLogPanel.jsx`**: Real-time terminal for backend generation activity.
- **`UIOverlay.jsx`**: Main UI controls, filters, and the "Legend" system.
- **`LoadingSkeleton.jsx`**: High-fidelity placeholders for graph initialization.

### Hooks & Business Logic (`/frontend/src/hooks`)
- **`useDashboard.js`**: **Primary State Manager.** Extracts all business logic from App.jsx. Handles API calls, WS processing, and command execution.
- **`useWebSocket.ts`**: Robust hook for the real-time data stream with auto-reconnect.
- **`useMultiplayer.js`**: Presence and cursor synchronization for collaborative analysis.
- **`useCamera.js`**: Smooth camera transitions and "Follow Node" behavior.
- **`useGlow.js`**: Real-time animation logic for node vitality effects.
- **`useVoiceRecognition.js`**: Integration with Web Speech API for voice commands.

### Services & Utilities (`/frontend/src/utils`)
- **`apiClient.js`**: Axios-based client with global interceptors for auth and errors.
- **`SoundSystem.js`**: Audio engine for sonification of data events.
- **`ProceduralSoundGenerator.ts`**: Real-time synthesis of "Neural" soundscapes.
- **`stateEncoder.js`**: Encoding/Decoding of UI state into shareable "Deep-Link" hashes.
- **`mathUtils.js`**: Geometry and projection helpers for 3D space.

### Context & Stores (`/frontend/src/stores` / `context`)
- **`WindowManagerContext.jsx`**: Manages the desktop-like windowing sub-system.
- **`CommandRegistryContext.jsx`**: Central hub for voice and keyboard commands.
- **`graphStore.js`**: Zustand store for graph data (nodes, edges, clusters).
- **`viewStore.js`**: UI state store (active lens, view mode, sidebars).
- **`connectionStore.js`**: Database connection state.
- **`authStore.js`**: User session and security state.
- **`intelligenceStore.js`**: AI metrics and ML suggestion state.
