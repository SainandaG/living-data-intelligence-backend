# 🏛️ Full Stack System Architecture: Block Diagram

> [!TIP]
> **How to see these diagrams in VS Code:**
> Press **`Ctrl + Shift + V`** on your keyboard to open the **Markdown Preview** window!

## ⬛ High-Level Block View (Image)
![Block Architecture Overview](file:///C:/Users/karth/.gemini/antigravity/brain/27e38f8a-0732-4928-b2b4-05c5e6b68f4a/block_architecture_diagram_boxes_1773991380887.png)

## 🏗️ Interactive Functional Blueprint

```mermaid
graph TD
    classDef box fill:#111,stroke:#333,stroke-width:2px,color:#fff,font-weight:bold;
    classDef database fill:#062,stroke:#090,stroke-width:2px,color:#fff;
    classDef frontend fill:#048,stroke:#08f,stroke-width:2px,color:#fff;
    classDef backend fill:#620,stroke:#f80,stroke-width:2px,color:#fff;
    classDef layer fill:none,stroke:#666,stroke-dasharray: 5 5;

    subgraph "USER INTERFACE (FRONTEND)"
        VALK["[ 3D VALKYRIE RENDERER ]"]:::frontend
        DASH["[ ANALYTICAL DASHBOARD ]"]:::frontend
        ML_UI["[ ML CONFIG MODAL ]"]:::frontend
    end

    subgraph "INTELLIGENCE ENGINE (BACKEND API)"
        FAST["[ FASTAPI CONTROLLER ]"]:::backend
        NEUR["[ NEURAL CORE SERVICES ]"]:::backend
        ML_EXC["[ SKLEARN ML EXECUTOR ]"]:::backend
    end

    subgraph "DATA ADAPTORS"
        SQL["[ ASYNC SQL CONNECTOR ]"]:::box
        NOSQL["[ MONGODB CONNECTOR ]"]:::box
        SCH["[ SCHEMA ANALYZER ]"]:::box
    end

    subgraph "PERSISTENCE LAYER"
        DB_PG["[( POSTGRESQL )]"]:::database
        DB_MY["[( MYSQL )]"]:::database
        DB_MD["[( MONGODB )]"]:::database
    end

    %% Flow
    DB_PG & DB_MY & DB_MD --> SQL & NOSQL
    SQL & NOSQL --> SCH
    SCH --> NEUR
    NEUR --> FAST
    ML_EXC --> FAST
    FAST ===|WebSocket / REST| VALK & DASH & ML_UI
```

---

## 🎨 3D Isometric Ecosystem
![Systems Architecture Diagram](file:///C:/Users/karth/.gemini/antigravity/brain/27e38f8a-0732-4928-b2b4-05c5e6b68f4a/full_repo_architecture_diagram_1773991266618.png)

```mermaid
graph TB
    subgraph "External Data Layer"
        PG[(PostgreSQL)]
        MY[(MySQL)]
        MG[(MongoDB)]
    end

    subgraph "Backend: FastAPI Intelligence Engine"
        API[API Routers: Graph, ML, AI, WS]
        
        subgraph "Core Services"
            SA[SchemaAnalyzer]
            NC[Neural Core: State Machine]
            GG[GraphGenerator: 3D Topology]
            MLA[ML Analysis: Scikit-Learn]
        end
        
        subgraph "Supporting Layers"
            DB[DB Connector: Async Engines]
            AI_AGENTS[AI Agents: Chat & Optimization]
            MON[Realtime Monitor]
        end

        DB --> SA
        SA --> NC
        NC --> GG
        RS[Result Set] --> MLA
        MON -->|WebSocket| WS_API[WebSocket Handler]
    end

    subgraph "Frontend: React Immersive UI"
        SPA[React SPA: Vite]
        
        subgraph "State & Logic"
            STORE[Zustand / useDashboard Hook]
            AC[apiClient: Axios]
        end

        subgraph "Visualization Core"
            VALK[Valkyrie 3D Engine: Three.js/R3F]
            DEEP[Deep Analysis: Recharts]
            UI_COMP[UI Components: Tailwind v4]
        end

        AC -->|REST| API
        STORE --> VALK
        STORE --> DEEP
    end

    %% Key Interconnections
    PG & MY & MG -.->|Read-Only| DB
    WS_API ===|Live Metrics| STORE
    SA -.->|Metadata| GG
    GG -.->|Coordinates| VALK
    MLA -.->|Predictions| DEEP
    AI_AGENTS -.->|Natural Language| UI_COMP
```

---
**One Complete View — Mapping the intelligence of data in 3D space.**
