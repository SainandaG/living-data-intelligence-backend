# Living Data Intelligence Platform

Transform database schemas into interactive 3D visualizations with real-time transaction flow monitoring, AI-powered analytics, and enterprise-grade security.

---

## 🔧 Features

- **3D Graph Visualization** — Interactive Three.js force-directed database schema visualization
- **Real-time Monitoring** — Live TPS tracking, WebSocket-powered performance metrics
- **AI Chat** — Natural language queries powered by Google Gemini & Groq LLMs
- **Work on Data (ML Engine)** — Classification, Regression, Clustering, and Time Series Forecasting
- **Neural Core** — Intelligent schema analysis and relationship discovery
- **Multi-Database Support** — PostgreSQL, MySQL, MongoDB, DuckDB, CSV/Excel file uploads
- **Dual Clustering Methods** — Heuristic prefix-based or NetworkX graph-theory clustering
- **APEX Autonomous Agent** — Self-directed AI agent with planning, tool use, and memory
- **Decision Hub** — Structured decision capture, tracking, and analysis
- **Latent Space Explorer** — UMAP/t-SNE/PCA dimensionality reduction visualization
- **Traffic Dashboard** — Real-time API traffic monitoring with anomaly detection
- **Explainable AI (SHAP)** — Understand *why* models make decisions with natural language insights
- **Firebase Authentication** — Google/email sign-in via Firebase + JWT session management
- **MFA / TOTP** — Time-based one-time password support for all users
- **RBAC** — Role-based access control (Admin, Analyst, Viewer)
- **Audit Logs** — Full audit trail for all sensitive operations

---

### Clustering Options

The system supports two clustering methods for organizing database tables:

#### 1. Heuristic Clustering (Default)
- **Method**: Prefix-based pattern matching
- **Best for**: Databases with naming conventions (e.g., `auth_user`, `auth_group`)
- **Speed**: Instant
- **Accuracy**: ~60–80% (depends on naming consistency)

#### 2. NetworkX Clustering (Advanced)
- **Method**: Louvain community detection + PageRank
- **Best for**: Any database structure, especially complex schemas
- **Speed**: <100ms for typical schemas
- **Accuracy**: ~95% (uses actual foreign key relationships)

**API Usage**:
```bash
# Heuristic clustering
POST /api/optimize
{ "connection_id": "your-id", "active": true, "method": "heuristic" }

# NetworkX clustering
POST /api/optimize
{ "connection_id": "your-id", "active": true, "method": "networkx" }
```

---

### 🧠 Work on Data (Advanced ML Analysis)

Production-grade ML subsystem for deep data exploration:

- **Predictive Analytics** — Classification and Regression (RandomForest, GradientBoosting) with MLflow experiment tracking
- **Explainable AI (SHAP)** — Game-theoretic model interpretability with natural language summaries
- **Schema-Aware Intelligence** — Automatically joins related tables via discovered foreign key relationships
- **Time Series Forecasting** — Seasonal decomposition and trend projection
- **Professional Reporting** — Download comprehensive PDF analytics reports in one click
- **Asynchronous Architecture** — Background job processing via APScheduler for large datasets

---

## 📋 Prerequisites

- Python 3.10+
- Node.js 18+ / npm 9+
- PostgreSQL, MySQL, or MongoDB instance (or connect a CSV/Excel file)
- Modern web browser with WebGL support
- Firebase project (for authentication) — see [firebase-key.example.json](backend/firebase-key.example.json)

---

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repo-url>
cd living-data-intelligence-backend-sasir
```

### 2. Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure environment

```bash
# Windows
copy .env.template .env

# Linux/Mac
cp .env.template .env
```

Then edit `backend/.env` with your credentials:

| Key | Required | Description |
|---|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | ✅ | PostgreSQL/Neon connection |
| `GOOGLE_API_KEY` | ✅ | Google Gemini AI key |
| `GROQ_API_KEY` | ✅ | Groq LLM key |
| `JWT_SECRET_KEY` | ✅ | Random 256-bit secret (`openssl rand -hex 32`) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | ✅ | Path to your `firebase-key.json` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` | ✅ | Initial admin credentials |

> For Firebase setup, copy `backend/firebase-key.example.json` → `backend/firebase-key.json` and fill in your project credentials from the [Firebase Console](https://console.firebase.google.com/).

### 4. Frontend setup

```bash
cd frontend
npm install
```

---

## 🚀 Running the Application

Run backend and frontend in separate terminals:

### Terminal 1 — Backend

```bash
cd backend
python main.py
```

Backend API available at: **`http://localhost:8001`**
Interactive docs: **`http://localhost:8001/docs`**

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

UI available at: **`http://localhost:5173`**

---

### 📊 Quick Start Guide

1. Open **`http://localhost:5173`** in your browser
2. Sign in with your admin credentials (or via Firebase Google sign-in)
3. Click **"Connect DB"** in the header
4. Enter your database credentials to start AI analysis
5. Explore the 3D Network and use **Drill Down** to inspect table internals
6. Click **Work on Data** to run ML analysis on any table

---

## 🎨 Technology Stack

### Backend
| Library | Purpose |
|---|---|
| **FastAPI** ≥0.115 | Async Python web framework |
| **Uvicorn** | ASGI server |
| **asyncpg / aiomysql / motor** | Async database drivers (PG, MySQL, MongoDB) |
| **DuckDB + Pandas** | File-based database (CSV/Excel uploads) |
| **SQLAlchemy + Alembic** | ORM and migrations |
| **Scikit-Learn, NumPy** | ML analysis pipeline |
| **SHAP** | Model explainability |
| **MLflow** | ML experiment tracking |
| **PyTorch + TensorFlow-CPU** | GNN model inference |
| **NetworkX + python-louvain** | Graph clustering algorithms |
| **ReportLab** | PDF report generation |
| **APScheduler** | Background job scheduling |
| **Redis** | Caching and session storage |
| **firebase-admin** | Firebase Auth verification |
| **passlib + python-jose** | Password hashing and JWT |
| **pyotp + qrcode** | TOTP-based MFA |
| **slowapi** | Rate limiting |
| **WebSockets** | Real-time bidirectional communication |

### Frontend
| Library | Purpose |
|---|---|
| **React 18** | Component-based UI |
| **Three.js** | 3D WebGL graph visualization |
| **Framer Motion** | Fluid micro-animations |
| **Tailwind CSS** | Styling and glassmorphism effects |
| **Zustand** | State management |
| **Axios** | HTTP client with JWT refresh |
| **Vite** | Build tool and dev server |

---

## 📁 Project Structure

```
living-data-intelligence-backend-sasir/
├── backend/
│   ├── app/
│   │   ├── api/                    # 39 REST API route handlers
│   │   │   ├── auth.py             # JWT + Firebase authentication
│   │   │   ├── database.py         # Database connection endpoints
│   │   │   ├── graph.py            # 3D graph generation
│   │   │   ├── ml_analysis.py      # Work on Data ML endpoints
│   │   │   ├── apex_agent.py       # APEX autonomous agent API
│   │   │   ├── decisions.py        # Decision Hub endpoints
│   │   │   ├── traffic.py          # Traffic monitoring API
│   │   │   ├── mfa_api.py          # MFA / TOTP endpoints
│   │   │   ├── audit_api.py        # Audit log endpoints
│   │   │   ├── admin.py            # Admin & user management
│   │   │   └── ...                 # 29 more route modules
│   │   ├── services/               # Business logic layer (59 services)
│   │   │   ├── db_connector.py     # Async DB pools (PG, MySQL, Mongo)
│   │   │   ├── auth.py             # JWT + bcrypt auth service
│   │   │   ├── neural_core.py      # AI-powered schema analysis
│   │   │   ├── graph_generator.py  # 3D graph construction
│   │   │   ├── graph_optimizer_nx.py # NetworkX clustering
│   │   │   ├── rbac_service.py     # Role-based access control
│   │   │   ├── mfa_service.py      # TOTP MFA service
│   │   │   ├── traffic_service.py  # Traffic analytics
│   │   │   ├── redis_client.py     # Redis cache client
│   │   │   ├── xai_service.py      # SHAP explainability
│   │   │   ├── t0_agent.py         # APEX T0 orchestrator agent
│   │   │   ├── t1_agent.py         # APEX T1 worker agents
│   │   │   └── ...                 # 47 more services
│   │   ├── agents/                 # Agent action handlers
│   │   ├── config/                 # Logging, feature flags
│   │   └── middleware/             # Request middleware
│   ├── ml/                         # GNN models and embeddings
│   ├── tests/                      # Backend tests (pytest)
│   ├── migrations/                 # Alembic database migrations
│   ├── main.py                     # FastAPI entry + lifespan manager
│   ├── router_registry.py          # Centralized route registration
│   ├── Dockerfile                  # Multi-stage production build
│   ├── requirements.txt            # Python dependencies
│   ├── .env.template               # Environment variable template ← copy to .env
│   └── firebase-key.example.json   # Firebase key structure template
├── frontend/
│   ├── src/
│   │   ├── components/             # 90+ React UI components
│   │   │   ├── ThreeGraph.jsx      # 3D Three.js force graph
│   │   │   ├── WorkOnDataModal.jsx # ML analysis launcher
│   │   │   ├── AuthPage.jsx        # Login / Firebase sign-in
│   │   │   ├── DecisionBoard.jsx   # Decision Hub UI
│   │   │   ├── LatentSpaceOverlay.jsx # Latent space visualizer
│   │   │   └── ...                 # 85+ more components
│   │   ├── utils/apiClient.js      # Axios + JWT refresh interceptor
│   │   ├── stores/                 # Zustand state management
│   │   └── test/                   # Vitest test setup
│   ├── nginx.conf                  # Dev Nginx config
│   ├── nginx.production.conf       # Production TLS Nginx config
│   └── Dockerfile                  # Multi-stage Nginx build
├── docs/                           # Technical documentation
├── .github/workflows/ci.yml        # CI pipeline
├── docker-compose.yml              # Dev orchestration
└── docker-compose.production.yml   # Production: HTTPS + Certbot
```

---

## 📊 How It Works

1. **Connect** — Platform connects to your database (read-only operations only)
2. **Analyze** — AI analyzes schema structure, detects tables, columns, relationships
3. **Classify** — Tables categorized as fact (transactional) or dimension (reference)
4. **Visualize** — 3D graph generated with nodes (tables) and edges (relationships)
5. **Monitor** — Real-time data flows shown as animated particles between nodes
6. **Insights** — Business metrics, anomalies, and patterns displayed in real-time

---

## 🔒 Security

- **Read-only** database connections — no data modification
- **JWT authentication** with refresh token rotation
- **Firebase Auth** for Google sign-in and email/password
- **MFA / TOTP** for all user accounts
- **RBAC** — Admin, Analyst, Viewer roles
- **Rate limiting** via slowapi
- **Audit logs** for all sensitive operations
- **Environment-based secrets** — never hardcoded

---

## ❓ Troubleshooting

### Backend won't start
1. Ensure `.env` exists in `backend/` with all required keys
2. Check `GOOGLE_API_KEY` and `GROQ_API_KEY` are valid
3. Verify `FIREBASE_SERVICE_ACCOUNT_KEY` points to a valid `firebase-key.json`
4. Check the terminal for specific error logs

### "Neural Core: Analysis Failed"
1. Verify `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env`
2. Ensure your database server is running and accessible
3. Check `LOG_LEVEL=DEBUG` output for connection errors

### Firebase errors
1. Ensure `firebase-key.json` exists at the path in `FIREBASE_SERVICE_ACCOUNT_KEY`
2. Verify the Firebase project has **Authentication** enabled
3. Check that the service account has the required Firebase Admin permissions

### Port conflicts
- Backend runs on **port 8001** (not 8000)
- Frontend dev server runs on **port 5173**

---

## 🎯 Use Cases

### Banking
- Monitor transaction flows in real-time
- Detect fraud patterns visually
- Identify system bottlenecks and schema anomalies

### E-commerce
- Visualize order processing pipelines
- Monitor inventory movements and customer behavior flows

### Healthcare
- Patient data flow visualization
- Department interaction mapping and compliance monitoring

### Data Engineering
- Schema documentation and discovery
- Cross-table relationship mapping and lineage tracking

---

## 🤝 Contributing

Contributions are welcome! Please submit a Pull Request with a clear description of your changes.

---

## 📄 License

MIT License — free to use for any purpose.

---

## 🙏 Acknowledgments

- Three.js community for the 3D graphics library
- FastAPI team for the excellent Python framework
- Google Gemini and Groq for AI capabilities
- The open-source community

---

**Built with ❤️ for data visualization enthusiasts**
