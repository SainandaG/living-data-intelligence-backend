# Living Data Intelligence Platform

Transform database schemas into interactive 3D visualizations with real-time transaction flow monitoring.

## 🔧 Features

- **3D Graph Visualization**: Interactive Three.js-based database schema visualization
- **Real-time Monitoring**: Live TPS tracking and performance metrics
- **AI Chat**: Natural language queries powered by Google Gemini
- **Work on Data (New!)**: Advanced ML analysis with Classification, Regression, Clustering, and Time Series Forecasting
- **Neural Core**: Intelligent schema analysis and relationship discovery
- **Multi-Database Support**: MySQL, PostgreSQL, Neon, and more
- **Dual Clustering Methods**: Choose between heuristic or graph-theory-based clustering

### Clustering Options

The system supports two clustering methods for organizing database tables:

#### 1. Heuristic Clustering (Default)
- **Method**: Prefix-based pattern matching
- **Best for**: Databases with naming conventions (e.g., `auth_user`, `auth_group`)
- **Speed**: Instant
- **Accuracy**: ~60-80% (depends on naming consistency)

#### 2. NetworkX Clustering (Advanced)
- **Method**: Louvain community detection + PageRank
- **Best for**: Any database structure, especially complex schemas
- **Speed**: <100ms for typical schemas
- **Accuracy**: ~95% (uses actual foreign key relationships)

**API Usage**:
```bash
# Heuristic clustering
POST /api/optimize
{
  "connection_id": "your-id",
  "active": true,
  "method": "heuristic"
}

# NetworkX clustering
POST /api/optimize
{
  "connection_id": "your-id",
  "active": true,
  "method": "networkx"
}
```

### 🧠 Work on Data (Advanced ML Analysis)

The platform now features a production-grade ML subsystem for deep data exploration:

- **Predictive Analytics**: Classification and Regression models (RandomForest, GradientBoosting) to predict business outcomes.
- **Explainable AI (SHAP)**: Understand *why* the model makes decisions with integrated SHAP interpretability and natural language insights.
- **Schema-Aware Intelligence**: Automatically joins related tables for multi-dimensional analysis using discovered foreign key relationships.
- **Time Series Forecasting**: Project future trends based on historical data using seasonal decomposition.
- **Professional Reporting**: Generate and download comprehensive PDF Analytics Reports with one click.
- **Asynchronous Architecture**: High-performance background job processing for large-scale datasets.

## 📋 Prerequisites

- Python 3.8+
- PostgreSQL/MySQL/MongoDB database (for testing)
- Modern web browser with WebGL support

## 🛠️ Installation

### 1. Clone the repository

```bash
cd living-data-intelligence-backend
```

### 2. Create virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment

```bash
```bash
# Windows
type backend\.env.example > backend\.env

# Linux/Mac
cp backend/.env.example backend/.env
```
2. Edit `backend/.env` with your API keys and database credentials.
   - **Crucial**: You must set `GEMINI_API_KEY` and `DB_PASSWORD` for the Neural Core to function.
```

## 🚀 Running the Application

For the **High Fidelity** experience (React + 3D Visuals), you need to run both the backend and frontend.

### 1. Start the Backend Server (Terminal 1)
```bash
python main.py
```
Backend will be available on `http://localhost:8000`.

### 2. Start the Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
The **High Fidelity UI** will be available on **`http://localhost:5173`**.

### 3. Database Setup (First Run Only)
If you haven't set up the database yet:
1. Create a MySQL database named `aw`.
2. Run the scripts in `AdventureWorksDW/`:
   ```bash
   mysql -u root -p aw < AdventureWorksDW/create-database-tables.sql
   mysql -u root -p aw < AdventureWorksDW/add-constraints.sql
   ```


---

### 📊 Quick Start Guide
1. Open **`http://localhost:5173`** in your browser.
2. Click **"Connect DB"** in the header.
3. Use your database credentials to initiate the AI analysis.
4. Explore the 3D Network and use the **Drill Down** feature to see table internals.

## 🎨 Technology Stack

### Backend
- **FastAPI**: Modern Python web framework with async support
- **Uvicorn**: Lightning-fast ASGI server
- **ML Stack**: Scikit-Learn, Pandas, NumPy for high-performance analysis
- **SHAP**: Game-theoretic approach to explain model outputs
- **ReportLab**: Professional PDF generation engine
- **psycopg2/pymysql**: High-performance database adapters
- **WebSocket**: Real-time bidirectional communication

### Frontend
- **Three.js**: 3D graphics library for WebGL
- **React**: Modern component-based UI
- **Framer Motion**: Fluid micro-animations and transitions
- **Tailwind CSS**: Sleek, modern styling with glassmorphism effects

## 📊 How It Works

1. **Connect**: Platform connects to your database (read-only)
2. **Analyze**: AI analyzes schema structure, detects tables, columns, relationships
3. **Classify**: Tables categorized as fact (transactional) or dimension (reference)
4. **Visualize**: 3D graph generated with nodes (tables) and edges (relationships)
5. **Monitor**: Real-time data flows shown as particles moving between nodes
6. **Insights**: Business metrics and patterns displayed in real-time

## 🔒 Security

- Read-only database connections
- No data modification
- Secure WebSocket connections
- Environment variable configuration

## ❓ Troubleshooting

### "Neural Core: Analysis Failed"
This error usually means the backend cannot connect to the database or an API key is missing.
1. **Check `.env`**: Ensure `backend/.env` exists and has valid `DB_PASSWORD` and `GEMINI_API_KEY`.
2. **Check Database**: Ensure your MySQL server is running and the `aw` database exists.
3. **Check Console**: Look at the terminal running `main.py` for specific error logs (e.g., "Access denied for user").


## 📁 Project Structure

```
living-data-intelligence-backend/
├── backend/
│   ├── app/
│   │   ├── api/                    # 30+ REST API route handlers
│   │   │   ├── auth.py             # JWT authentication + dev-token
│   │   │   ├── database.py         # Database connection endpoints
│   │   │   ├── graph.py            # 3D graph generation endpoints
│   │   │   ├── ml_analysis.py      # Work on Data ML endpoints
│   │   │   ├── apex_agent.py       # APEX autonomous agent API
│   │   │   ├── decisions.py        # Decision Hub endpoints
│   │   │   └── ...                 # 20+ more route modules
│   │   ├── services/               # Business logic layer
│   │   │   ├── db_connector.py     # Async DB pools (PG, MySQL, Mongo)
│   │   │   ├── auth.py             # JWT + bcrypt auth service
│   │   │   ├── neural_core/        # AI-powered schema analysis
│   │   │   ├── apex_agent/         # Autonomous agent subsystem
│   │   │   ├── ml/                 # ML analysis pipeline
│   │   │   ├── decisions/          # Decision engine
│   │   │   └── realtime/           # Real-time monitoring
│   │   ├── config/                 # Logging, feature flags
│   │   └── middleware/             # Request middleware
│   ├── ml/                         # GNN models + embeddings
│   ├── tests/                      # 197+ backend tests (pytest)
│   ├── migrations/                 # Alembic database migrations
│   ├── main.py                     # FastAPI entry + lifespan
│   ├── router_registry.py          # Centralized route registration
│   ├── Dockerfile                  # Multi-stage production build
│   ├── requirements.txt            # Pinned Python dependencies
│   └── .env.example                # Environment template
├── frontend/
│   ├── src/
│   │   ├── components/             # React UI components
│   │   │   ├── Dashboard/          # 3D Three.js visualizations
│   │   │   ├── Auth/               # Login/auth flow
│   │   │   └── ...                 # 10+ component groups
│   │   ├── utils/apiClient.js      # Axios + JWT refresh
│   │   ├── stores/                 # Zustand state management
│   │   └── test/                   # Vitest test setup
│   ├── nginx.conf                  # Dev Nginx config
│   ├── nginx.production.conf       # Production TLS config
│   └── Dockerfile                  # Multi-stage Nginx build
├── .github/workflows/ci.yml        # CI pipeline
├── docker-compose.yml              # Dev orchestration
├── docker-compose.production.yml   # Prod: HTTPS + certbot
└── docs/                           # Technical documentation
```

## 🎯 Use Cases

### Banking
- Monitor transaction flows in real-time
- Detect fraud patterns visually
- Identify system bottlenecks
- Track branch performance

### E-commerce
- Visualize order processing pipelines
- Monitor inventory movements
- Track customer behavior flows
- Identify conversion bottlenecks

### Healthcare
- Patient data flow visualization
- Department interaction mapping
- Resource utilization tracking
- Compliance monitoring

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for any purpose.

## 🙏 Acknowledgments

- Three.js community for amazing 3D graphics library
- FastAPI team for the excellent Python framework
- The open-source community

## 🛡️ Security & Production Roadmap

The following areas have been identified for immediate hardening as part of the production readiness phase:

- **Secret Management**: Transition all DB and AI keys to secure environment variables (ensure `.env` is never committed).
- **Service Hardening**: Implement SQL injection protection for all AI-to-SQL conduit services.
- **Authentication**: Implementation of JWT-based authentication layer (Planned).
- **Concurrency**: Hardening of the asynchronous ML analysis pipeline for multi-user support.

---

**Built with ❤️ for data visualization enthusiasts**
