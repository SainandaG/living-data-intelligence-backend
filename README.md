# Living Data Intelligence Platform

Transform database schemas into interactive 3D visualizations with real-time transaction flow monitoring.

## 🚀 Features

- **Database Connectivity**: Connect to PostgreSQL, MySQL, and MongoDB databases
- **Automatic Schema Analysis**: AI-powered detection of fact/dimension tables and relationships
- **3D Visualization**: Interactive Three.js visualization with circle packing layout
- **Real-Time Monitoring**: WebSocket-based live transaction flow tracking
- **Particle System**: Visual representation of data flowing between entities
- **Business Insights**: Fraud detection, bottleneck identification, and performance metrics

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
copy .env.example .env
# Edit .env with your database credentials
```

## 🚀 Running the Application

### Start the server

```bash
python main.py
```

The application will start on `http://localhost:8000`

### Access the platform

1. Open your browser to `http://localhost:8000`
2. Click "Connect Database"
3. Enter your database credentials
4. Watch as your database schema transforms into a living 3D visualization!

## 🎨 Technology Stack

### Backend
- **FastAPI**: Modern Python web framework with async support
- **Uvicorn**: Lightning-fast ASGI server
- **psycopg2**: PostgreSQL adapter
- **pymysql**: MySQL connector
- **pymongo**: MongoDB driver
- **WebSocket**: Real-time bidirectional communication

### Frontend
- **Three.js**: 3D graphics library for WebGL
- **Vanilla JavaScript**: No framework overhead
- **Modern CSS**: Glassmorphism and gradient aesthetics

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

## 📁 Project Structure

```
living-data-intelligence-backend/
├── app/
│   ├── api/                 # API route handlers
│   │   ├── database.py      # Database connection endpoints
│   │   ├── schema.py        # Schema analysis endpoints
│   │   ├── graph.py         # Graph generation endpoints
│   │   └── metrics.py       # Real-time metrics endpoints
│   ├── models/              # Pydantic models
│   │   └── schemas.py       # Data validation models
│   └── services/            # Business logic
│       ├── db_connector.py  # Database connection manager
│       ├── schema_analyzer.py # Schema introspection
│       ├── ai_classifier.py # AI table classification
│       ├── graph_generator.py # 3D graph generation
│       ├── realtime_monitor.py # Real-time data monitoring
│       └── connection_manager.py # WebSocket manager
├── static/
│   ├── css/
│   │   └── styles.css       # Application styles
│   ├── js/
│   │   ├── app.js           # Main application controller
│   │   ├── visualization.js # Three.js 3D visualization
│   │   └── particle-system.js # Particle flow system
│   └── index.html           # Main HTML page
├── main.py                  # FastAPI application entry point
├── requirements.txt         # Python dependencies
└── .env.example            # Environment variables template
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

---

**Built with ❤️ for data visualization enthusiasts**
