# 📁 Technical Appendix - Complete File Analysis

**Living Data Intelligence Platform - Repository Deep Dive**

---

## Table of Contents

1. [Repository Structure](#repository-structure)
2. [Backend Services Detailed](#backend-services-detailed)
3. [Frontend Components Detailed](#frontend-components-detailed)
4. [API Endpoints Detailed](#api-endpoints-detailed)
5. [Configuration Files](#configuration-files)
6. [Database & Models](#database--models)
7. [Utility Modules](#utility-modules)
8. [Testing Infrastructure](#testing-infrastructure)

---

## Repository Structure

```
living-data-intelligence-backend/
├── backend/                          # Python FastAPI backend
│   ├── app/                          # Main application package
│   │   ├── api/                      # API route handlers (19 files)
│   │   ├── services/                 # Business logic (42 services)
│   │   ├── models/                   # Data models
│   │   ├── config/                   # Configuration
│   │   ├── agents/                   # AI agent modules
│   │   ├── ai/                       # AI utilities
│   │   ├── middleware/               # Custom middleware
│   │   ├── routers/                  # Additional routers
│   │   ├── shared/                   # Shared utilities
│   │   ├── utils/                    # Utility functions
│   │   └── visualization/            # Visualization helpers
│   ├── config/                       # Backend configuration
│   ├── docs/                         # Backend documentation
│   ├── events/                       # Event definitions
│   ├── explainability/               # XAI modules
│   ├── ml/                           # Machine learning models
│   ├── neural_state/                 # Neural core state
│   ├── static/                       # Static files
│   ├── tests/                        # Unit tests
│   ├── visualization/                # Visualization services
│   ├── main.py                       # Application entry (203 lines)
│   ├── requirements.txt              # Python dependencies
│   └── .env.example                  # Environment template
├── frontend/                         # React frontend
│   ├── src/                          # Source code
│   │   ├── components/               # React components (31 files)
│   │   │   ├── Dashboard/            # Dashboard components (16)
│   │   │   ├── Evolution/            # Evolution features (4)
│   │   │   ├── Layout/               # Layout components (3)
│   │   │   ├── Voice/                # Voice control (2)
│   │   │   ├── WindowManager/        # Window system (3)
│   │   │   ├── UI/                   # UI utilities (1)
│   │   │   └── Apps/                 # App components (2)
│   │   ├── agents/                   # Frontend agents (8 files)
│   │   ├── audio/                    # Audio system (4 files)
│   │   ├── context/                  # React contexts (2 files)
│   │   ├── hooks/                    # Custom hooks (4 files)
│   │   ├── services/                 # API services (3 files)
│   │   ├── utils/                    # Utilities (5 files)
│   │   ├── 3d/                       # 3D utilities (2 files)
│   │   ├── App.jsx                   # Main app (635 lines)
│   │   ├── main.jsx                  # Entry point
│   │   └── index.css                 # Global styles
│   ├── public/                       # Public assets
│   ├── package.json                  # Dependencies
│   ├── vite.config.js                # Vite configuration
│   └── tailwind.config.js            # Tailwind config
├── shared/                           # Shared TypeScript definitions
│   └── command-definitions.ts        # Command types
├── scripts/                          # Utility scripts
├── docs/                             # Documentation
├── tests/                            # Integration tests
├── README.md                         # Main readme
├── DOCUMENTATION_HUB.md              # Technical manual
├── FEATURES_COMPLETE.md              # Feature list
├── ADVANCED_FEATURES.md              # Advanced features
├── HIERARCHICAL_FLOW_GUIDE.md        # Flow guide
└── start_production.ps1              # Production startup
```

---

## Backend Services Detailed

### Intelligence Layer Services

#### 1. neural_core.py (512 lines)
**Purpose:** Active Schema Intelligence engine  
**Key Features:**
- Multi-connection state management
- Real-time schema analysis
- Relationship prediction using name similarity
- Column-level intelligence calculation
- Gravity weight persistence
- Learning state tracking (Initializing → Learning → Optimized)

**Key Methods:**
- `initialize()` - Prepare core for analysis
- `update_schema_context()` - Receive schema snapshot
- `process_signal()` - Advance analysis cursor
- `save_snapshot()` - Persist neural state
- `predict_links()` - Identify potential relationships
- `get_column_intelligence()` - Granular column analysis

#### 2. agent_service.py (275 lines)
**Purpose:** Autonomous AI agent orchestration  
**Key Features:**
- Background exploration worker
- Autonomous schema analysis
- Gravity suggestion engine
- Table classification
- Relationship analysis
- Natural language chat integration

**Key Methods:**
- `start_autonomous_loop()` - Start background agent
- `_exploration_worker()` - Main autonomous loop
- `analyze_new_connection()` - Seed neural core
- `get_gravity_suggestions()` - Suggest important columns
- `analyze_relationships()` - Discover semantic relationships
- `chat_with_data()` - Process NL queries

#### 3. agent_analyst.py (3077 lines)
**Purpose:** Background pattern analysis  
**Key Features:**
- Continuous data pattern discovery
- Trend identification
- Anomaly correlation
- Insight generation

#### 4. agent_state_manager.py (11536 lines)
**Purpose:** Agent state persistence  
**Key Features:**
- State serialization
- Recovery mechanisms
- Multi-agent coordination
- State versioning

#### 5. ai_classifier.py (11947 lines)
**Purpose:** Table classification engine  
**Key Features:**
- Fact vs Dimension classification
- Heuristic pattern matching
- Semantic analysis
- Confidence scoring
- Multi-database support

**Classification Logic:**
- Analyzes table names for patterns (fact_, dim_, ref_)
- Examines column types (timestamps, amounts, quantities)
- Counts foreign keys vs primary keys
- Generates confidence scores

#### 6. analysis_engine.py (7184 lines)
**Purpose:** Data analysis orchestration  
**Key Features:**
- Coordinate multiple analysis services
- Generate comprehensive insights
- Pattern aggregation
- Report generation

#### 7. anomaly_detector.py (9155 lines)
**Purpose:** Statistical anomaly detection  
**Key Features:**
- Z-score analysis (>3σ detection)
- IQR outlier detection
- Rolling window baselines
- Natural language explanations
- Severity classification

**Detection Methods:**
```python
# Z-Score Method
z_score = (current_value - mean) / std_deviation
if z_score > 3.0:
    severity = "critical" if z_score > 5 else "warning"

# IQR Method
Q1, Q3 = percentile(data, [25, 75])
IQR = Q3 - Q1
outliers = data < (Q1 - 1.5*IQR) or data > (Q3 + 1.5*IQR)
```

#### 8. causal_intelligence.py (3142 lines)
**Purpose:** Causal relationship inference  
**Key Features:**
- Causal graph construction
- Intervention analysis
- Counterfactual reasoning

### Data Services

#### 9. db_connector.py (14805 lines)
**Purpose:** Multi-database connection manager  
**Key Features:**
- PostgreSQL, MySQL, MongoDB support
- Connection pooling
- Async operations
- Timeout management
- Error recovery
- Read-only enforcement

**Supported Databases:**
- PostgreSQL (psycopg2)
- MySQL (pymysql)
- MongoDB (pymongo)
- SQLAlchemy ORM support

#### 10. schema_analyzer.py (14695 lines)
**Purpose:** Schema introspection and analysis  
**Key Features:**
- Bulk metadata extraction
- Table structure discovery
- Primary/Foreign key detection
- Column type analysis
- Index information
- Constraint details
- TTL-based caching

**Optimization:**
- Uses `information_schema` bulk queries
- O(1) query complexity
- Caches results to prevent redundant scans

#### 11. connection_manager.py (6627 lines)
**Purpose:** WebSocket connection pooling  
**Key Features:**
- Active connection tracking
- Heartbeat monitoring
- Automatic reconnection
- Message broadcasting
- Connection lifecycle management

#### 12. data_flow_analyzer.py (8650 lines)
**Purpose:** Data lineage tracking  
**Key Features:**
- Parent-child relationship mapping
- Flow direction analysis
- Dependency graph construction
- Impact analysis

#### 13. drill_down.py (11196 lines)
**Purpose:** Table detail exploration  
**Key Features:**
- Column-level details
- Sample data retrieval
- Relationship mapping
- Index analysis
- Constraint information

#### 14. hierarchical_flow.py (6311 lines)
**Purpose:** Hierarchical relationship mapping  
**Key Features:**
- Tree structure generation
- Depth-first traversal
- Circular dependency detection
- Level-based grouping

### Visualization Services

#### 15. graph_generator.py (15532 lines)
**Purpose:** 3D graph data generation  
**Key Features:**
- Node data preparation
- Edge relationship mapping
- Position calculation
- Metadata enrichment
- Cluster assignment

**Output Format:**
```json
{
  "nodes": [
    {
      "id": "users",
      "type": "dimension",
      "vitality": 0.8,
      "pos": [10, 5, -2],
      "rowCount": 1500,
      "cluster": "auth"
    }
  ],
  "edges": [
    {
      "source": "orders",
      "target": "users",
      "strength": 0.9,
      "type": "foreign_key"
    }
  ]
}
```

#### 16. graph_intelligence.py (8268 lines)
**Purpose:** Health scoring and vitality  
**Key Features:**
- Real-time health score (0-100)
- Vitality calculations per node
- Pulse rate determination
- Glow intensity mapping

**Health Deduction Matrix:**
- High load (>1200 TX/min): -20 points
- Fraud spike (>5 alerts): -30 points
- Error rate (>25 failed TX): -25 points
- Low activity (<100 TX/min): -10 points

#### 17. graph_optimizer_nx.py (9197 lines)
**Purpose:** NetworkX-based clustering  
**Key Features:**
- Louvain community detection
- PageRank centrality
- Betweenness centrality
- Modularity optimization
- ~95% accuracy

#### 18. gravity_engine.py (4360 lines)
**Purpose:** Physics-based positioning  
**Key Features:**
- PCA dimension reduction
- K-Means clustering
- Force-directed layout
- Attraction/repulsion forces

#### 19. living_graph_engine.py (4707 lines)
**Purpose:** Adaptive graph behaviors  
**Key Features:**
- Breathing animations
- Dynamic sizing
- Pulse rate adaptation
- Glow effects

### AI & Chat Services

#### 20. chat_service.py (397 lines)
**Purpose:** Natural language processing  
**Key Features:**
- Groq API integration (primary)
- Google Gemini fallback
- OpenAI compatibility
- SQL query generation
- Context-aware responses
- Conversation history

**AI Provider Priority:**
1. Groq (fast, generous free tier)
2. Google Gemini (fallback)
3. OpenAI (optional)

#### 21. intent_classifier.py (16909 lines)
**Purpose:** User intent detection  
**Key Features:**
- Command classification
- Entity extraction
- Confidence scoring
- Multi-intent handling

#### 22. context_manager.py (7168 lines)
**Purpose:** Conversation context tracking  
**Key Features:**
- Session management
- Context window maintenance
- Entity tracking
- History pruning

#### 23. command_registry.py (8369 lines)
**Purpose:** Voice command processing  
**Key Features:**
- Command registration
- Parameter extraction
- Validation
- Execution routing

#### 24. xai_service.py (4231 lines)
**Purpose:** Explainable AI insights  
**Key Features:**
- Decision explanation
- Feature importance
- Confidence intervals
- Natural language generation

### Real-Time Services

#### 25. realtime_monitor.py (6131 lines)
**Purpose:** Live metrics streaming  
**Key Features:**
- TPS calculation
- WebSocket broadcasting
- Metric aggregation
- Anomaly integration

**Metrics Tracked:**
- Transactions per second
- Active nodes
- Fraud alerts
- Failed transactions
- Average amounts
- Health score

#### 26. metrics_service.py (5112 lines)
**Purpose:** System metrics collection  
**Key Features:**
- Memory usage
- CPU utilization
- Connection pool status
- Query execution times
- Custom KPI tracking

#### 27. vitals_service.py (2332 lines)
**Purpose:** Health monitoring  
**Key Features:**
- System vitals
- Component health checks
- Dependency monitoring
- Alerting

#### 28. event_bus.py (2094 lines)
**Purpose:** Event-driven messaging  
**Key Features:**
- Pub/sub pattern
- Event routing
- Async handlers
- Event history

### Advanced Features

#### 29. latent_manager.py (5622 lines)
**Purpose:** Latent space coordination  
**Key Features:**
- Latent mode orchestration
- State synchronization
- View transitions

#### 30. latent_space_service.py (9653 lines)
**Purpose:** Latent visualization logic  
**Key Features:**
- Manifold generation
- Organic layout algorithms
- Emitter calculations
- Height mapping

#### 31. temporal_analyzer.py (10783 lines)
**Purpose:** Time-series analysis  
**Key Features:**
- Historical data analysis
- Trend detection
- Seasonality identification
- Forecasting

#### 32. time_machine.py (3150 lines)
**Purpose:** Historical playback  
**Key Features:**
- State snapshots
- Timeline navigation
- Rewind capability
- Future simulation

#### 33. evolution_engine.py (6305 lines)
**Purpose:** Evolution simulation  
**Key Features:**
- Node birth animations
- Growth simulation
- Lifecycle tracking

#### 34. rl_optimizer.py (2453 lines)
**Purpose:** Reinforcement learning optimization  
**Key Features:**
- Layout optimization
- Reward functions
- Policy learning

### Utility Services

#### 35. action_policy.py (3890 lines)
**Purpose:** Agent action rules  
**Key Features:**
- Policy definitions
- Action validation
- Rule engine

#### 36. cluster_store.py (1792 lines)
**Purpose:** Clustering persistence  
**Key Features:**
- Cluster caching
- Method storage
- Result retrieval

#### 37. seeder.py (6870 lines)
**Purpose:** Demo data generation  
**Key Features:**
- Synthetic data creation
- Realistic patterns
- Configurable scenarios

#### 38. neo4j_connector.py (1726 lines)
**Purpose:** Neo4j graph database support  
**Key Features:**
- Cypher query execution
- Graph data import/export

### Specialized Agents

#### 39. t0_agent.py (7905 lines)
**Purpose:** Tier 0 autonomous agent  
**Key Features:**
- Basic autonomous exploration
- Pattern recognition
- Simple decision making

#### 40. t0_agent_v2.py (3854 lines)
**Purpose:** Enhanced T0 agent  
**Key Features:**
- Improved algorithms
- Better performance
- Extended capabilities

#### 41. t1_agent.py (17363 lines)
**Purpose:** Tier 1 specialized agent  
**Key Features:**
- Advanced reasoning
- Complex task handling
- Multi-step planning

### Handler Services

#### 42. handlers/ (5 files)
**Purpose:** Command handlers for various operations

**Files:**
- Graph action handlers
- Data exploration handlers
- Schema operation handlers
- Metric query handlers
- Evolution control handlers

---

## Frontend Components Detailed

### Dashboard Components

#### 1. ThreeGraph.jsx (2405 lines)
**Purpose:** Main 3D visualization engine  
**Key Features:**
- Fibonacci sphere layout algorithm
- Latent space mode support
- Lens system (Security, Executive, Ops, 3D Tables)
- Particle flow system (1000+ particles at 60fps)
- Camera controls (orbit, zoom, pan)
- Node interaction (click, hover, drag)
- Force-directed physics (D3)
- WebGL rendering optimization

**Layout Modes:**
- `galaxy` - Fibonacci sphere distribution
- `latent` - AI-driven organic layout

**Lens Types:**
- `ops` - Operational view (default)
- `security` - Risk-based coloring
- `executive` - Importance filtering
- `3d_tables` - Voxel mesh clusters

**Key Functions:**
- `applyGalaxyLayout()` - Golden spiral positioning
- `applyLatentSpaceLayout()` - Organic AI layout
- `createNodeMesh()` - Node geometry generation
- `createCurvedEdge()` - Bezier curve edges
- `createParticle()` - Flow particle creation
- `createStarfield()` - Nebula background

#### 2. LatentWorld.jsx (832 lines)
**Purpose:** Latent space explorer  
**Key Features:**
- Orbiting satellite view for columns
- Column intelligence visualization
- Bloom effects and custom shaders
- Interactive controls (glow, spread, bloom)
- Real-time shader parameter adjustment
- Context loss recovery
- Responsive canvas management

**View Modes:**
- `galaxy` - Standard force-directed layout
- `internal` - Orbiting satellite view (drill-down)

**Semantic Column Clustering:**
- **Cyan (#00d4ff)**: Identity cluster (Primary Keys, IDs)
- **Gold (#ffd700)**: Temporal cluster (Dates, timestamps)
- **Purple (#bf00ff)**: Reference cluster (Foreign keys)
- **Green (#00ff88)**: Numeric cluster (Quantities, amounts)
- **Red (#ff6b6b)**: Text cluster (Names, descriptions)
- **Orange (#ff9500)**: Flags cluster (Booleans, status flags)

**Visual Elements:**
- Intelligent color-coded satellites by semantic type
- Cluster-based positioning and grouping
- Nebula starfield background
- Bloom post-processing
- API-driven clustering via `/api/internal-node/clusters`

#### 3. ChatInterface.jsx
**Purpose:** AI chat component  
**Key Features:**
- Natural language query input
- Markdown rendering with syntax highlighting
- Code block support
- SQL execution from chat
- Conversation history
- Auto-scroll to latest message
- Loading states

#### 4. DataFlowView.jsx
**Purpose:** Data flow visualization  
**Key Features:**
- Hierarchical flow mapping
- Particle animations along paths
- Flow direction indicators
- Throughput visualization
- Color-coded flows (normal/warning/critical)

#### 5. DrillDownView.jsx
**Purpose:** Table detail explorer  
**Key Features:**
- Circle packing layout
- Column details panel
- Relationship explorer
- Sample data preview
- Index information display

#### 6. HealthDashboard.jsx
**Purpose:** System health monitoring  
**Key Features:**
- Health score display (0-100)
- Metric charts (TPS, errors, alerts)
- Alert notifications
- Trend visualization
- Historical data

#### 7. IntelligencePanel.jsx
**Purpose:** Neural Core status display  
**Key Features:**
- Model state indicator
- Accuracy tracking
- Learning progress bar
- Agent activity log
- Exploration status

#### 8. AnalyticsView.jsx
**Purpose:** Analytics dashboard  
**Key Features:**
- KPI tracking
- Trend analysis
- Custom metrics
- Chart components
- Export capabilities

#### 9. SchemaView.jsx
**Purpose:** Schema tree view  
**Key Features:**
- Hierarchical structure display
- Table relationships
- Column details
- Expandable/collapsible nodes
- Search functionality

#### 10. Record3DGraph.jsx
**Purpose:** Record-level 3D visualization  
**Key Features:**
- PCA-based positioning
- Row clustering
- Detail tooltips
- Color coding by category
- Interactive selection

#### 11. RecordForceGraph.jsx
**Purpose:** Force-directed record graph  
**Key Features:**
- D3 physics simulation
- Interactive nodes
- Relationship edges
- Zoom and pan
- Node filtering

#### 12. EdgeStatsPanel.jsx
**Purpose:** Edge statistics display  
**Key Features:**
- Relationship metrics
- Flow statistics
- Connection strength
- Directionality indicators

#### 13. SemanticDiscoveryPanel.jsx
**Purpose:** AI relationship discovery  
**Key Features:**
- Predicted relationships display
- Confidence scores
- Semantic links
- Validation controls

#### 14. UIOverlay.jsx
**Purpose:** UI overlays and legends  
**Key Features:**
- Legend component (node types, colors)
- Circle pack overlay
- Stats dashboard
- Tooltip system

### Evolution Components

#### 17. EvolutionOverlay.jsx
**Purpose:** Evolution controls  
**Key Features:**
- Timeline controls
- Playback speed
- Snapshot selection
- Animation triggers

#### 18. EvolutionMathOverlay.jsx
**Purpose:** Mathematical overlays  
**Key Features:**
- Formula display
- Calculation visualization
- Parameter adjustment

#### 19. NodeFormationSimulation.jsx
**Purpose:** Node birth animations  
**Key Features:**
- Birth flash effects
- Growth animations
- Particle emissions
- Sound effects integration

#### 20. TimelinePlayer.jsx
**Purpose:** Historical playback controls  
**Key Features:**
- Timeline slider
- Play/pause controls
- Speed adjustment
- Snapshot markers

### Layout Components

#### 21. DashboardLayout.jsx
**Purpose:** Main layout container  
**Key Features:**
- Responsive grid layout
- Panel management
- Resize handlers
- Breakpoint handling

#### 22. NavigationBar.jsx
**Purpose:** Top navigation  
**Key Features:**
- Connection status
- Health score display
- Tab navigation
- Lens selector
- Settings access

#### 23. Sidebars.jsx
**Purpose:** Left and right sidebars  
**Key Features:**
- Collapsible panels
- Quick actions
- Metrics display
- Intelligence panel

### Voice Components

#### 24. VoiceControl.jsx
**Purpose:** Voice command interface  
**Key Features:**
- Speech recognition
- Waveform visualization
- Command feedback
- Voice activation
- Noise cancellation

#### 25. AgentStatusPanel.jsx
**Purpose:** AI agent status display  
**Key Features:**
- Agent activity indicator
- Current task display
- Exploration progress
- Findings list

### Window Management

#### 26. ConnectionModal.jsx
**Purpose:** Database connection modal  
**Key Features:**
- Connection form
- Database type selector
- Credential input
- Test connection
- Save connection

#### 27. Taskbar.jsx
**Purpose:** Window taskbar  
**Key Features:**
- Open windows list
- Window switching
- Minimize all
- Close all

#### 28. Window.jsx
**Purpose:** Draggable window component  
**Key Features:**
- Drag and drop
- Resize handles
- Minimize/maximize
- Z-index management
- Close button

### UI Components

#### 29. CollapsiblePanel.jsx
**Purpose:** Collapsible panel utility  
**Key Features:**
- Expand/collapse animation
- Header customization
- Content slot
- State persistence

### App Components

#### 30. AnalystChat.jsx
**Purpose:** Analyst chat interface  
**Key Features:**
- Dedicated analyst mode
- Advanced query capabilities
- Result visualization
- Export options

#### 31. Settings.jsx
**Purpose:** Application settings  
**Key Features:**
- User preferences
- Theme selection
- Performance settings
- API configuration

---

## API Endpoints Detailed

### Database Management Endpoints

#### POST /api/connect
**Purpose:** Create new database connection  
**Request Body:**
```json
{
  "type": "mysql|postgresql|mongodb",
  "host": "localhost",
  "port": 3306,
  "database": "mydb",
  "user": "root",
  "password": "secret"
}
```
**Response:**
```json
{
  "connection_id": "uuid-string",
  "status": "connected",
  "schema_count": 15
}
```

#### GET /api/connections
**Purpose:** List all active connections  
**Response:**
```json
{
  "connections": [
    {
      "id": "uuid",
      "type": "mysql",
      "database": "mydb",
      "status": "active",
      "created_at": "2026-02-09T10:00:00Z"
    }
  ]
}
```

#### DELETE /api/connections/{id}
**Purpose:** Remove database connection  
**Response:**
```json
{
  "status": "disconnected",
  "message": "Connection closed successfully"
}
```

#### GET /api/schema/{connection_id}
**Purpose:** Get database schema  
**Response:**
```json
{
  "tables": [
    {
      "name": "users",
      "columns": [...],
      "primary_keys": [...],
      "foreign_keys": [...]
    }
  ]
}
```

### Graph & Visualization Endpoints

#### GET /api/graph/{connection_id}
**Purpose:** Get 3D graph data  
**Query Parameters:**
- `lens` - Visualization lens (ops|security|executive|3d_tables)
- `layout` - Layout mode (galaxy|latent)

**Response:**
```json
{
  "nodes": [...],
  "edges": [...],
  "metadata": {
    "health_score": 92,
    "neural_accuracy": 0.74,
    "total_tables": 25
  }
}
```

#### POST /api/graph/data
**Purpose:** Request graph with filters  
**Request Body:**
```json
{
  "connection_id": "uuid",
  "filters": {
    "table_types": ["fact", "dimension"],
    "min_rows": 100
  }
}
```

#### POST /api/optimize
**Purpose:** Apply clustering  
**Request Body:**
```json
{
  "connection_id": "uuid",
  "active": true,
  "method": "networkx|heuristic"
}
```

#### POST /api/gravity/calculate
**Purpose:** Calculate table positions  
**Request Body:**
```json
{
  "table": "transactions",
  "limit": 500
}
```

### Analytics & Insights Endpoints

#### GET /api/metrics/live
**Purpose:** Real-time metrics stream  
**Response:** Server-Sent Events (SSE)
```
data: {"tps": 1250, "health": 85, "alerts": 2}
```

#### POST /api/ai/classify
**Purpose:** Classify table types  
**Request Body:**
```json
{
  "connection_id": "uuid",
  "table_name": "orders"
}
```
**Response:**
```json
{
  "classification": "fact",
  "confidence": 0.92,
  "reasoning": "Contains timestamp and amount columns"
}
```

#### POST /api/ai/chat
**Purpose:** Natural language query  
**Request Body:**
```json
{
  "query": "Show me the most active tables",
  "connection_id": "uuid",
  "history": []
}
```
**Response:**
```json
{
  "response": "The most active tables are...",
  "highlight_nodes": ["orders", "transactions"],
  "sql_executed": "SELECT ..."
}
```

#### GET /api/data-flow/{table_name}
**Purpose:** Get data flow analysis  
**Response:**
```json
{
  "upstream": [...],
  "downstream": [...],
  "flow_paths": [...]
}
```

#### GET /api/hierarchy/{table_name}
**Purpose:** Get hierarchical structure  
**Response:**
```json
{
  "root": "customers",
  "children": [...],
  "depth": 3
}
```

### Drill-Down & Exploration Endpoints

#### GET /api/drilldown/{connection_id}/{table_name}
**Purpose:** Table drill-down data  
**Response:**
```json
{
  "table": "users",
  "columns": [...],
  "sample_data": [...],
  "relationships": [...],
  "indexes": [...]
}
```

#### GET /api/internal-node/clusters/{connection_id}/{table_name}
**Purpose:** Get semantic column clusters for Latent World internal view  
**New Feature:** Powers the orbiting satellite visualization with intelligent column grouping

**Response:**
```json
{
  "status": "success",
  "table_name": "customer",
  "total_columns": 12,
  "clusters": [
    {
      "id": "identity",
      "name": "Identity",
      "columns": ["customer_id", "email"],
      "color": "#00d4ff",
      "type": "identity",
      "count": 2
    },
    {
      "id": "temporal",
      "name": "Temporal",
      "columns": ["created_at", "updated_at"],
      "color": "#ffd700",
      "type": "temporal",
      "count": 2
    },
    {
      "id": "reference",
      "name": "References",
      "columns": ["address_id", "store_id"],
      "color": "#bf00ff",
      "type": "reference",
      "count": 2
    },
    {
      "id": "numeric",
      "name": "Numeric",
      "columns": ["loyalty_points", "total_purchases"],
      "color": "#00ff88",
      "type": "numeric",
      "count": 2
    },
    {
      "id": "text",
      "name": "Text",
      "columns": ["first_name", "last_name", "phone"],
      "color": "#ff6b6b",
      "type": "text",
      "count": 3
    },
    {
      "id": "boolean",
      "name": "Flags",
      "columns": ["is_active"],
      "color": "#ff9500",
      "type": "boolean",
      "count": 1
    }
  ]
}
```

**Clustering Logic:**
- **Identity**: Primary keys, IDs, unique identifiers (contains '_id', 'id_', 'key' or is_primary_key)
- **Temporal**: Date/time columns (type contains 'date', 'time', 'timestamp')
- **Reference**: Foreign keys (is_foreign_key or contains '_fk')
- **Numeric**: Integer/decimal/float columns (type contains 'int', 'decimal', 'float', 'numeric')
- **Text**: String columns (varchar, text, char)
- **Flags**: Boolean/bit columns (type contains 'bool', 'bit' or name starts with 'is_', 'has_', 'active')

**Use Case:** Enables the Latent World component to display columns as color-coded orbiting satellites around the table node

#### POST /api/data-explorer/query
**Purpose:** Execute custom query  
**Request Body:**
```json
{
  "connection_id": "uuid",
  "sql": "SELECT * FROM users LIMIT 10"
}
```

### Evolution & ML Endpoints

#### GET /api/evolution/timeline
**Purpose:** Get evolution timeline  
**Response:**
```json
{
  "snapshots": [
    {
      "timestamp": "2026-02-09T10:00:00Z",
      "state": {...}
    }
  ]
}
```

#### POST /api/ml/predict
**Purpose:** ML predictions  
**Request Body:**
```json
{
  "model": "relationship_predictor",
  "input": {...}
}
```

#### GET /api/events/stream
**Purpose:** Event stream  
**Response:** Server-Sent Events

### Intelligence & Explainability Endpoints

#### POST /api/intelligence/analyze
**Purpose:** Intelligent analysis  
**Request Body:**
```json
{
  "connection_id": "uuid",
  "analysis_type": "relationships|patterns|anomalies"
}
```

#### GET /api/explainability/insights
**Purpose:** Get XAI insights  
**Response:**
```json
{
  "insights": [
    {
      "type": "pattern",
      "description": "...",
      "confidence": 0.85
    }
  ]
}
```

#### GET /api/vitals/health
**Purpose:** System health check  
**Response:**
```json
{
  "status": "healthy",
  "components": {
    "database": "ok",
    "neural_core": "learning",
    "websocket": "connected"
  }
}
```

---

## Configuration Files

### Backend Configuration

#### .env.example
```bash
# Server Configuration
PORT=8001
HOST=0.0.0.0

# Database Configuration
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=your_database
DB_USER=root
DB_PASSWORD=your_password

# AI API Keys
GROQ_API_KEY=your_groq_key
GOOGLE_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key

# Feature Flags
ENABLE_AI_CLASSIFICATION=true
ENABLE_VOICE_CONTROL=true
ENABLE_EVOLUTION=true

# Performance
REFRESH_INTERVAL=5000
MAX_PARTICLES=1000
WEBSOCKET_PING_INTERVAL=30

# Logging
LOG_LEVEL=INFO
```

#### requirements.txt
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-dotenv==1.0.0
psycopg2-binary==2.9.9
pymongo==4.6.1
pymysql==1.1.0
cryptography==41.0.7
sqlalchemy==2.0.25
websockets==12.0
pydantic==2.5.3
python-multipart==0.0.6
aiofiles==23.2.1
google-generativeai==0.3.2
groq==1.0.0
numpy==1.26.4
networkx==3.2.1
python-louvain==0.16
```

### Frontend Configuration

#### package.json
```json
{
  "name": "frontend",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.4.2",
    "axios": "^1.13.2",
    "d3": "^7.9.0",
    "d3-force-3d": "^3.0.6",
    "framer-motion": "^12.23.26",
    "react": "^19.2.0",
    "three": "^0.182.0"
  }
}
```

#### vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8001',
      '/ws': {
        target: 'ws://localhost:8001',
        ws: true
      }
    }
  }
})
```

#### tailwind.config.js
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {}
  }
}
```

---

## Database & Models

### Models Directory

#### schemas.py
**Purpose:** Pydantic data validation models  
**Models:**
- `ConnectionRequest` - Database connection parameters
- `GraphRequest` - Graph generation parameters
- `ChatMessage` - Chat message structure
- `MetricUpdate` - Real-time metric updates
- `AnomalyAlert` - Anomaly notification
- `TableSchema` - Table structure definition

---

## Utility Modules

### Backend Utilities

#### app/utils/
- Database helpers
- String utilities
- Date/time functions
- Validation helpers

### Frontend Utilities

#### src/utils/

**1. apiClient.js**
- Axios instance configuration
- Request/response interceptors
- Error handling
- Token management

**2. SoundSystem.js**
- Web Audio API wrapper
- Oscillator network
- Sonification logic
- Spatial audio

**3. mathUtils.js**
- Seeded RNG
- Vector operations
- Matrix transformations
- Statistical functions

**4. formatters.js**
- Number formatting
- Date formatting
- String utilities

**5. validators.js**
- Input validation
- Schema validation
- Type checking

---

## Testing Infrastructure

### Backend Tests

#### tests/ (8 files)
- `test_neural_core.py` - Neural core unit tests
- `test_db_connector.py` - Database connection tests
- `test_schema_analyzer.py` - Schema analysis tests
- `test_graph_generator.py` - Graph generation tests
- `test_anomaly_detector.py` - Anomaly detection tests
- `test_chat_service.py` - Chat service tests
- `test_api_endpoints.py` - API integration tests
- `test_websocket.py` - WebSocket tests

### Frontend Tests
- Component tests
- Integration tests
- E2E tests

---

## Code Architecture Patterns

### Backend Patterns

1. **Service Layer Pattern**
   - Business logic in services
   - API routes delegate to services
   - Services are singleton instances

2. **Dependency Injection**
   - Services injected via FastAPI
   - Global instances for stateful services

3. **Async/Await**
   - All I/O operations are async
   - Non-blocking database queries
   - Concurrent request handling

4. **Event-Driven**
   - Event bus for inter-service communication
   - WebSocket for real-time updates
   - Pub/sub pattern

### Frontend Patterns

1. **Component Composition**
   - Small, focused components
   - Reusable UI elements
   - Props-based configuration

2. **Context API**
   - Global state management
   - Window manager context
   - Command registry context

3. **Custom Hooks**
   - Reusable logic
   - Side effect management
   - State encapsulation

4. **Imperative Handles**
   - Parent-child communication
   - Method exposure
   - Ref forwarding

---

## Performance Optimizations

### Backend
- Connection pooling
- Query result caching
- Async operations
- Bulk queries
- Lazy loading

### Frontend
- Instanced rendering (Three.js)
- React.memo for expensive components
- Debounced API calls
- Virtual scrolling
- Code splitting

---

**Document Version:** 1.0  
**Last Updated:** February 9, 2026  
**Total Files Analyzed:** 100+  
**Total Lines of Code:** ~150,000+
